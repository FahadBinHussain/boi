const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { archiveDir, generated, tables } = require("./paths");
const { readJsonl, writeJsonl } = require("./jsonl-store");

const limit = Number(process.env.CANDIDATE_ROKOMARI_DUP_LIMIT || 100);
const delayMs = Number(process.env.CANDIDATE_ROKOMARI_DUP_DELAY_MS || 250);
const dryRun = process.argv.includes("--dry-run") || process.argv.includes("--check");
const liveVerify = process.env.CANDIDATE_ROKOMARI_DUP_LIVE !== "0";
const researchId =
  process.env.CANDIDATE_ROKOMARI_DUP_RESEARCH_ID ||
  `candidate_rokomari_duplicate_merge_${new Date().toISOString().slice(0, 10)}`;

const genericAuthorPattern =
  /^(?:anonymous|author|creator|darulilm|fatwaa|fatwa|unknown|not available|n\.?\s*a\.?|na|none|null|rasikulindia|allboi|muster a)$/i;

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

function hasLatin(value) {
  return /[A-Za-z]/.test(String(value || ""));
}

function hasBangla(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function latinKey(value) {
  return cleanText(value)
    ?.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[''`]/g, "")
    .replace(/[^\p{Script=Latin}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const stopWords = new Set([
  "a",
  "an",
  "and",
  "bengali",
  "book",
  "books",
  "by",
  "edition",
  "of",
  "pdf",
  "series",
  "the",
  "vol",
  "volume"
]);

function tokens(value) {
  const key = latinKey(value);
  if (!key) return [];
  return key
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function dice(a, b) {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return (2 * overlap) / (left.size + right.size);
}

function containsScore(a, b) {
  const left = latinKey(a);
  const right = latinKey(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftTokens = left.split(/\s+/).filter(Boolean).length;
  const rightTokens = right.split(/\s+/).filter(Boolean).length;
  if (leftTokens === 1 && rightTokens === 1) {
    const lengthRatio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
    if (lengthRatio < 0.8) return 0;
  }
  const coverage = Math.min(leftTokens, rightTokens) / Math.max(leftTokens, rightTokens);
  if (coverage < 0.75) return 0;
  if (left.length >= 6 && right.includes(left)) return 0.92;
  if (right.length >= 6 && left.includes(right)) return 0.92;
  return 0;
}

function similarity(a, b) {
  if (!a || !b) return 0;
  return Math.max(containsScore(a, b), dice(a, b));
}

function normalizeDigitString(value) {
  const banglaDigits = "০১২৩৪৫৬৭৮৯";
  return Array.from(String(value || ""))
    .map((character) => {
      const banglaIndex = banglaDigits.indexOf(character);
      return banglaIndex >= 0 ? String(banglaIndex) : character;
    })
    .join("");
}

function digits(value) {
  return Array.from(normalizeDigitString(value).matchAll(/[0-9]+/g)).map((match) => match[0]);
}

function digitCompatible(candidateTitle, matchedField) {
  const candidateDigits = digits(candidateTitle);
  if (!candidateDigits.length) return true;
  const fieldDigits = new Set(digits(matchedField));
  return candidateDigits.every((digit) => fieldDigits.has(digit));
}

function rokomariProductId(url) {
  return String(url || "").match(/\/book\/(\d+)(?:\/|$)/)?.[1] || null;
}

function rokomariSlug(url) {
  const match = String(url || "").match(/\/book\/\d+\/([^/?#]+)/);
  return match ? match[1].replace(/-/g, " ") : null;
}

function sourceIsRokomariProduct(source) {
  return Boolean(rokomariProductId(source?.url));
}

function sourceRefsForWork(workId) {
  const refs = new Set();
  const work = workById.get(workId);
  for (const sourceRef of work?.source_refs || []) refs.add(sourceRef);
  for (const edition of editions) {
    if (edition.work_id !== workId) continue;
    for (const sourceRef of edition.source_refs || []) refs.add(sourceRef);
  }
  for (const contribution of contributions) {
    if (contribution.work_id !== workId) continue;
    for (const sourceRef of contribution.source_refs || []) refs.add(sourceRef);
  }
  return Array.from(refs);
}

function authorsForWork(workId) {
  return contributions
    .filter((contribution) => contribution.work_id === workId)
    .map((contribution) => authorById.get(contribution.author_id))
    .filter(Boolean);
}

function authorNamesForWork(workId) {
  return authorsForWork(workId)
    .flatMap((author) => [author.name_en, ...(author.aliases || [])])
    .map(cleanText)
    .filter(Boolean)
    .filter(hasLatin);
}

function candidateAuthors(candidate) {
  return (candidate.authors || [])
    .flatMap((author) => [author.name_en, author.name_bn])
    .map(cleanText)
    .filter(Boolean)
    .filter((name) => hasLatin(name))
    .filter((name) => !genericAuthorPattern.test(name));
}

function titleFieldsForWork(workId) {
  const work = workById.get(workId);
  const fields = [];
  if (work?.title_en && hasLatin(work.title_en)) fields.push({ value: work.title_en, from: "work.title_en" });
  for (const sourceRef of sourceRefsForWork(workId)) {
    const source = sourceById.get(sourceRef);
    if (!source) continue;
    if (source.raw_title && hasLatin(source.raw_title)) fields.push({ value: source.raw_title, from: source.id });
    const slug = rokomariSlug(source.url);
    if (slug) fields.push({ value: slug, from: source.id });
  }
  return fields;
}

function rokomariProductSourcesForWork(workId) {
  return sourceRefsForWork(workId)
    .map((sourceRef) => sourceById.get(sourceRef))
    .filter(sourceIsRokomariProduct)
    .sort((a, b) => {
      const aMain = a.id.startsWith("source_rokomari_book_") ? 0 : 1;
      const bMain = b.id.startsWith("source_rokomari_book_") ? 0 : 1;
      return aMain - bMain || a.id.localeCompare(b.id);
    });
}

function bestTitleScore(candidateTitle, fields) {
  let best = null;
  for (const field of fields) {
    if (!digitCompatible(candidateTitle, field.value)) continue;
    const score = similarity(candidateTitle, field.value);
    if (!best || score > best.score) best = { ...field, score };
  }
  return best;
}

function bestAuthorScore(candidateNames, targetNames) {
  let best = null;
  for (const candidateName of candidateNames) {
    for (const targetName of targetNames) {
      const score = similarity(candidateName, targetName);
      if (!best || score > best.score) {
        best = { candidate: candidateName, target: targetName, score };
      }
    }
  }
  return best;
}

function candidateResearchStatus(candidate) {
  const text = JSON.stringify(candidate.sources || []);
  return text.match(/Candidate source research:\s*([a-z_]+)/i)?.[1] || null;
}

function isCandidateWork(candidate) {
  if (candidateResearchStatus(candidate) === "not_book") return false;
  if (candidateResearchStatus(candidate) === "not_bangla_book") return false;
  const title = cleanText(candidate.title_en || candidate.title_bn);
  if (!title || hasBangla(title) || !hasLatin(title)) return false;
  return candidateAuthors(candidate).length > 0;
}

function isAcceptedMatch(candidate, target, titleBest, authorBest) {
  if (!titleBest || !authorBest) return false;
  if (titleBest.score < 0.92 || authorBest.score < 0.8) return false;

  const title = cleanText(candidate.title_en || candidate.title_bn);
  const titleKey = latinKey(title);
  if (!titleKey || titleKey.length < 2) return false;
  if (titleKey.length <= 3 && (titleBest.score < 1 || authorBest.score < 0.98)) return false;

  const targetWork = workById.get(target.work_id);
  if (!targetWork || targetWork.language !== "bn") return false;
  if (!digits(title).length) {
    const targetTitleText = [targetWork.title_bn, targetWork.title_en, titleBest.value].filter(Boolean).join(" ");
    if (digits(targetTitleText).length) return false;
    if (/(?:\bpart\b|\bvol(?:ume)?\b|খণ্ড|ভলিউম|পর্ব|সংখ্যা|সমগ্র)/iu.test(targetTitleText)) return false;
  }
  return rokomariProductSourcesForWork(target.work_id).length > 0;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "bn,en-US;q=0.9,en;q=0.8",
      "cache-control": "no-cache"
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Fetch failed ${response.status}`);
  return text;
}

function parseSpecTable($) {
  const specs = {};
  $(".details-book-additional-info table tr, .details-book-additional-info .table tr").each((_, row) => {
    const cells = $(row)
      .find("td,th")
      .map((__, cell) => cleanText($(cell).text()))
      .get()
      .filter(Boolean);
    if (cells.length >= 2) specs[cells[0].toLowerCase()] = cells.slice(1).join(" ");
  });
  return specs;
}

function parseLiveProduct(html) {
  const $ = cheerio.load(html);
  const specs = parseSpecTable($);
  const authorLink = $(".details-book-main-info").first().find('a[href*="/book/author/"]').first();
  return {
    title_bn: cleanText(specs.title) || cleanText($("h1").first().text()),
    title_en: cleanText($("#js--product-en-name").attr("value")),
    author_bn: cleanText(specs.author) || cleanText(authorLink.text()),
    author_en: cleanText($("#js--product-author-name").attr("value")),
    language: cleanText(specs.language),
    page_title: cleanText($("title").first().text())
  };
}

function liveProductLooksCompatible(product, targetWork) {
  const targetTitle = cleanText(targetWork.title_bn || targetWork.title_en);
  if (!targetTitle) return false;
  if (hasBangla(targetTitle) && product.title_bn && product.title_bn.includes(targetTitle)) return true;
  if (product.title_en && similarity(targetTitle, product.title_en) >= 0.9) return true;
  if (product.page_title && similarity(targetTitle, product.page_title) >= 0.9) return true;
  return false;
}

async function liveVerifyMatch(match) {
  if (!liveVerify) return { verified: true, skipped: true };
  const productSource = match.target.product_sources[0];
  if (!productSource?.url) return { verified: false, error: "No Rokomari product URL" };
  const targetWork = workById.get(match.target.work_id);
  try {
    const product = parseLiveProduct(await fetchText(productSource.url));
    const verified = liveProductLooksCompatible(product, targetWork);
    return {
      verified,
      product,
      url: productSource.url,
      error: verified ? null : "Live product title did not match target main work"
    };
  } catch (error) {
    return {
      verified: false,
      url: productSource.url,
      error: error.message
    };
  }
}

function mergeArrayValues(...arrays) {
  const out = [];
  const seen = new Set();
  for (const values of arrays) {
    for (const value of values || []) {
      if (value === undefined || value === null) continue;
      const key = JSON.stringify(value);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

function mergeCandidateIntoTarget(candidateWorkId, targetWorkId) {
  const candidateWork = workById.get(candidateWorkId);
  const targetWork = workById.get(targetWorkId);
  if (!candidateWork || !targetWork) return false;

  const candidateSourceRefs = sourceRefsForWork(candidateWorkId);
  targetWork.source_refs = mergeArrayValues(targetWork.source_refs, candidateSourceRefs);
  targetWork.aliases = mergeArrayValues(targetWork.aliases, candidateWork.aliases, [
    candidateWork.title_en && hasLatin(candidateWork.title_en) ? candidateWork.title_en : null,
    candidateWork.title_bn && hasLatin(candidateWork.title_bn) ? candidateWork.title_bn : null
  ]);
  targetWork.confidence = Math.max(targetWork.confidence || 0, candidateWork.confidence || 0);
  targetWork.first_published_year = targetWork.first_published_year || candidateWork.first_published_year || null;

  if (!targetWork.title_en && candidateWork.title_en && hasLatin(candidateWork.title_en)) {
    targetWork.title_en = candidateWork.title_en;
  }

  works = works.filter((work) => work.id !== candidateWorkId);
  editions = editions.filter((edition) => edition.work_id !== candidateWorkId);
  contributions = contributions.filter((contribution) => contribution.work_id !== candidateWorkId);
  workById.delete(candidateWorkId);
  return true;
}

let sources = readJsonl(tables.sources);
let authors = readJsonl(tables.authors);
let works = readJsonl(tables.works);
let editions = readJsonl(tables.editions);
let contributions = readJsonl(tables.contributions);
const candidates = readJsonl(generated.candidateBooks);

const sourceById = new Map(sources.map((source) => [source.id, source]));
const authorById = new Map(authors.map((author) => [author.id, author]));
const workById = new Map(works.map((work) => [work.id, work]));
const candidateWorkIds = new Set(candidates.map((candidate) => candidate.normalized_work_id));

function buildTargets() {
  const targets = [];
  for (const work of works) {
    if (candidateWorkIds.has(work.id)) continue;
    const productSources = rokomariProductSourcesForWork(work.id);
    if (!productSources.length) continue;
    const titleFields = titleFieldsForWork(work.id);
    const authorFields = authorNamesForWork(work.id);
    if (!titleFields.length || !authorFields.length) continue;
    targets.push({
      work_id: work.id,
      title_fields: titleFields,
      author_fields: authorFields,
      product_sources: productSources
    });
  }
  return targets;
}

function findMatches() {
  const targets = buildTargets();
  const matches = [];
  const usableCandidates = candidates.filter(isCandidateWork);

  for (const candidate of usableCandidates) {
    const candidateTitle = candidate.title_en || candidate.title_bn;
    const candidateAuthorNames = candidateAuthors(candidate);
    let best = null;

    for (const target of targets) {
      const titleBest = bestTitleScore(candidateTitle, target.title_fields);
      if (!titleBest || titleBest.score < 0.92) continue;
      const authorBest = bestAuthorScore(candidateAuthorNames, target.author_fields);
      if (!authorBest || authorBest.score < 0.8) continue;
      if (!isAcceptedMatch(candidate, target, titleBest, authorBest)) continue;

      const score = titleBest.score * 0.7 + authorBest.score * 0.3;
      if (!best || score > best.score) {
        best = {
          candidate,
          target,
          title_best: titleBest,
          author_best: authorBest,
          score
        };
      }
    }

    if (best) matches.push(best);
  }

  return matches
    .sort((a, b) => b.score - a.score || a.candidate.normalized_work_id.localeCompare(b.candidate.normalized_work_id))
    .slice(0, limit);
}

async function main() {
  const matches = findMatches();
  const items = [];
  let mergedCount = 0;
  let skippedCount = 0;

  for (const [index, match] of matches.entries()) {
    const candidateTitle = match.candidate.title_en || match.candidate.title_bn;
    const targetWork = workById.get(match.target.work_id);
    console.log(`[${index + 1}/${matches.length}] ${candidateTitle} -> ${targetWork.title_bn || targetWork.title_en}`);

    const live = await liveVerifyMatch(match);
    if (!live.verified) {
      skippedCount += 1;
      items.push({
        status: "needs_manual_review",
        work_id: match.candidate.normalized_work_id,
        title_bn: match.candidate.title_bn || null,
        title_en: match.candidate.title_en || null,
        matched_main_work_id: match.target.work_id,
        evidence: `Local Rokomari-backed title+author match was found, but live verification failed: ${live.error}`,
        scores: {
          title_score: match.title_best.score,
          author_score: match.author_best.score,
          total_score: Math.round(match.score * 1000) / 1000
        },
        evidence_sources: live.url ? [{ label: "Rokomari book page", url: live.url }] : []
      });
      await sleep(delayMs);
      continue;
    }

    if (!dryRun && mergeCandidateIntoTarget(match.candidate.normalized_work_id, match.target.work_id)) {
      mergedCount += 1;
    } else if (dryRun) {
      mergedCount += 1;
    }

    items.push({
      status: "duplicate_merged_into_main",
      work_id: match.candidate.normalized_work_id,
      title_bn: match.candidate.title_bn || null,
      title_en: match.candidate.title_en || null,
      matched_main_work_id: match.target.work_id,
      matched_main_title_bn: targetWork.title_bn || null,
      matched_main_title_en: targetWork.title_en || null,
      evidence: `Live Rokomari product page plus existing main author alias/title-slug evidence verifies this candidate as a duplicate of ${match.target.work_id}; candidate source refs were merged into the main work.`,
      scores: {
        title_score: match.title_best.score,
        title_field: match.title_best.value,
        author_score: match.author_best.score,
        author_candidate: match.author_best.candidate,
        author_target: match.author_best.target,
        total_score: Math.round(match.score * 1000) / 1000
      },
      evidence_sources: [
        {
          label: "Rokomari book page",
          url: live.url || match.target.product_sources[0].url,
          notes: live.product
            ? `Live page title ${live.product.title_bn || live.product.title_en}; author ${live.product.author_bn || live.product.author_en || "unknown"}.`
            : "Existing Rokomari product URL verified by prior source record."
        }
      ],
      candidate_sources: match.candidate.sources
    });

    await sleep(delayMs);
  }

  if (!dryRun) {
    writeJsonl(tables.works, works);
    writeJsonl(tables.editions, editions);
    writeJsonl(tables.contributions, contributions);
  }

  const outPath = path.join(archiveDir, "candidate_source_research", `${researchId}.json`);
  writeJson(outPath, {
    generated_at: new Date().toISOString().slice(0, 10),
    dry_run: dryRun,
    live_verify: liveVerify,
    research_scope:
      "Duplicate reconciliation for romanized/English candidate rows against existing main works with Rokomari product evidence. Requires strong title-slug/title and author-alias match; live Rokomari page must still resolve before merge.",
    selection_summary: {
      limit,
      checked: matches.length,
      duplicate_merged_into_main: mergedCount,
      needs_manual_review: skippedCount
    },
    items
  });

  console.log(
    JSON.stringify(
      {
        output: path.relative(archiveDir, outPath).replaceAll("\\", "/"),
        checked: matches.length,
        duplicate_merged_into_main: mergedCount,
        needs_manual_review: skippedCount,
        dry_run: dryRun
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
