const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { mainDir, reportsDir, tables } = require("./paths");
const { readJsonl } = require("./jsonl-store");

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function numericArg(name, fallback) {
  const value = argValue(name);
  if (value === null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${name} must be a number`);
  return number;
}

const authorFilter = argValue("--author");
const limit = numericArg("--limit", 500);
const minScore = numericArg("--min-score", 0.88);
const minAuthorWorks = numericArg("--min-author-works", 2);
const outputPath =
  argValue("--output") || path.join(reportsDir, "author-title-duplicate-candidates.jsonl");
const summaryPath =
  argValue("--summary") || path.join(reportsDir, "author-title-duplicate-candidates-summary.json");
const mainDuplicateReviewsPath = path.join(mainDir, "main_duplicate_work_reviews.jsonl");

if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit must be a positive integer");
if (minScore < 0 || minScore > 1) throw new Error("--min-score must be between 0 and 1");
if (!Number.isInteger(minAuthorWorks) || minAuthorWorks < 2) {
  throw new Error("--min-author-works must be an integer >= 2");
}

const banglaDigits = new Map(
  Array.from("০১২৩৪৫৬৭৮৯").map((digit, index) => [digit, String(index)])
);

const invisiblePattern = /[\u200B-\u200D\uFEFF]/gu;
const banglaPattern = /[\u0980-\u09FF]/u;
const protectedBracketPattern =
  /\b(vol|volume|part|issue|no|edition)\b|খণ্ড|খন্ড|পর্ব|ভাগ|সংখ্যা|বর্ষ|অংশ|পারা|ভলিউম|সংস্করণ|কাণ্ড|কান্ড|সম্ভার|শ্রেণি|শ্রেণী/iu;
const formatNoisePattern =
  /^(paperback|hardcover|hard cover|royal size|premium|premium version|standard|blue cover|red cover|পেপারব্যাক|হার্ডকভার|রয়্যাল সাইজ|প্রিমিয়াম|প্রিমিয়াম|প্রিমিয়াম ভার্সন|স্ট্যান্ডার্ড|ব্লু কভার|রেড কভার|ছোট সাইজ|বড় সাইজ|বড় সাইজ|ডিমাই|সচিত্র)$/iu;
const publisherNoisePattern = /\b(book|books|house|library|publication|publications|publishers?)\b|বুক|হাউস|লাইব্রেরী|লাইব্রেরি|প্রকাশন|প্রকাশনী|পাবলিকেশন/iu;
const ordinalWords = new Map([
  ["first", "1"],
  ["one", "1"],
  ["প্রথম", "1"],
  ["1ম", "1"],
  ["second", "2"],
  ["two", "2"],
  ["দ্বিতীয়", "2"],
  ["দ্বিতীয়", "2"],
  ["2য়", "2"],
  ["2য়", "2"],
  ["third", "3"],
  ["three", "3"],
  ["তৃতীয়", "3"],
  ["তৃতীয়", "3"],
  ["3য়", "3"],
  ["3য়", "3"],
  ["fourth", "4"],
  ["four", "4"],
  ["চতুর্থ", "4"],
  ["4র্থ", "4"],
  ["fifth", "5"],
  ["five", "5"],
  ["পঞ্চম", "5"],
  ["5ম", "5"],
  ["sixth", "6"],
  ["six", "6"],
  ["ষষ্ঠ", "6"],
  ["6ষ্ঠ", "6"],
  ["seventh", "7"],
  ["seven", "7"],
  ["সপ্তম", "7"],
  ["7ম", "7"],
  ["eighth", "8"],
  ["eight", "8"],
  ["অষ্টম", "8"],
  ["8ম", "8"],
  ["ninth", "9"],
  ["nine", "9"],
  ["নবম", "9"],
  ["9ম", "9"],
  ["tenth", "10"],
  ["ten", "10"],
  ["দশম", "10"],
  ["10ম", "10"],
  ["eleventh", "11"],
  ["একাদশ", "11"],
  ["11তম", "11"],
  ["twelfth", "12"],
  ["দ্বাদশ", "12"],
  ["12তম", "12"],
  ["thirteenth", "13"],
  ["ত্রয়োদশ", "13"],
  ["ত্রয়োদশ", "13"],
  ["13তম", "13"]
]);

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(invisiblePattern, "").replace(/\s+/g, " ").trim();
  return text || null;
}

function hash(value) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 16);
}

function normalizeDigits(value) {
  return String(value || "").replace(/[০-৯]/gu, (digit) => banglaDigits.get(digit) || digit);
}

function normalizeText(value) {
  return (
    cleanText(value)
      ?.toLowerCase()
      .normalize("NFKC")
      .replace(/[’‘`´]/gu, "'")
      .replace(/[“”]/gu, '"')
      .replace(/[‐‑‒–—―]/gu, "-")
      .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
      .replace(/[০-৯]/gu, (digit) => banglaDigits.get(digit) || digit)
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

function stripBracketNoise(value) {
  return (
    cleanText(value)
      ?.replace(/\[([^\]]{1,40})\]/gu, (_match, content) => (canStripBracketContent(content) ? " " : ` ${content} `))
      .replace(/\(([^)]{1,40})\)/gu, (_match, content) => (canStripBracketContent(content) ? " " : ` ${content} `))
      .replace(/\{([^}]{1,40})\}/gu, (_match, content) => (canStripBracketContent(content) ? " " : ` ${content} `))
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

function canStripBracketContent(value) {
  const normalized = normalizeText(value);
  if (!normalized) return true;
  if (digitSignature(normalized)) return false;
  if (protectedBracketPattern.test(normalized)) return false;
  if (/^book [a-z0-9]+$/iu.test(normalized)) return false;
  return formatNoisePattern.test(normalized) || publisherNoisePattern.test(normalized);
}

function compactKey(value) {
  return normalizeText(value)?.replace(/\s+/g, "") || null;
}

function tokenSet(value) {
  const normalized = normalizeText(value);
  if (!normalized) return new Set();
  return new Set(normalized.split(" ").filter(Boolean));
}

function digitSignature(value) {
  return Array.from(normalizeDigits(value).matchAll(/[0-9]+/gu), (match) => match[0]).join("|");
}

function ordinalSignature(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  return normalized
    .split(" ")
    .map((token) => ordinalWords.get(token))
    .filter(Boolean)
    .join("|");
}

function discriminatorSignature(value) {
  return [digitSignature(value), ordinalSignature(value)].filter(Boolean).join("|");
}

function hasBangla(value) {
  return banglaPattern.test(String(value || ""));
}

function visibleTitle(work) {
  return cleanText(work.title_bn) || cleanText(work.title_en) || work.id;
}

function authorVisibleName(author) {
  return cleanText(author.name_bn) || cleanText(author.name_en) || author.id;
}

function groupAuthorVisibleName(group) {
  return cleanText(group.author_name_bn) || cleanText(group.author_name_en) || group.author_id;
}

function authorKeys(author) {
  return [author.name_bn, author.name_en, ...(author.aliases || [])].map(normalizeText).filter(Boolean);
}

function titleValues(work) {
  const values = [work.title_bn, work.title_en, ...(work.aliases || [])].map(cleanText).filter(Boolean);
  const seen = new Set();
  return values.filter((value) => {
    const key = normalizeText(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function titleVariants(work) {
  return titleValues(work).flatMap((value) => {
    const stripped = stripBracketNoise(value);
    return [
      {
        raw: value,
        loose: normalizeText(value),
        compact: compactKey(value),
        tokens: tokenSet(value),
        digits: discriminatorSignature(value),
        source: "raw"
      },
      stripped && stripped !== value
        ? {
            raw: stripped,
            loose: normalizeText(stripped),
            compact: compactKey(stripped),
            tokens: tokenSet(stripped),
            digits: discriminatorSignature(stripped),
            source: "bracket_stripped"
          }
        : null
    ].filter(Boolean);
  });
}

function levenshteinRatio(left, right) {
  if (left === right) return 1;
  if (!left || !right) return 0;
  const a = Array.from(left);
  const b = Array.from(right);
  if (!a.length || !b.length) return 0;
  if (Math.abs(a.length - b.length) > Math.max(3, Math.ceil(Math.max(a.length, b.length) * 0.25))) return 0;

  let previous = Array.from({ length: b.length + 1 }, (_value, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }

  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

function numberConflict(left, right) {
  if (left.digits && right.digits && left.digits !== right.digits) return "number_conflict_needs_manual_check";
  if (left.digits !== right.digits) return "number_missing_on_one_side_needs_manual_check";
  return null;
}

function compareVariants(left, right) {
  if (!left.compact || !right.compact) return null;
  const reasons = [];
  let score = 0;

  if (left.loose && left.loose === right.loose) {
    score = 1;
    reasons.push("exact_normalized_title");
  }

  if (left.compact === right.compact) {
    score = Math.max(score, left.loose === right.loose ? 1 : 0.98);
    if (left.loose !== right.loose) reasons.push("spacing_or_punctuation_variant");
  }

  if (left.source === "bracket_stripped" || right.source === "bracket_stripped") {
    if (left.compact === right.compact || left.loose === right.loose) {
      score = Math.max(score, 0.96);
      reasons.push("bracket_or_publisher_suffix_variant");
    }
  }

  const shorter = left.compact.length <= right.compact.length ? left.compact : right.compact;
  const longer = left.compact.length > right.compact.length ? left.compact : right.compact;
  if (shorter.length >= 7 && longer.includes(shorter)) {
    const containment = shorter.length / longer.length;
    if (containment >= 0.9 || longer.length - shorter.length <= 4) {
      score = Math.max(score, 0.9 + containment * 0.05);
      reasons.push("contained_title_variant");
    }
  }

  const tokenScore = jaccard(left.tokens, right.tokens);
  if (tokenScore >= 0.86 && left.tokens.size > 1 && right.tokens.size > 1) {
    score = Math.max(score, 0.87 + tokenScore * 0.08);
    reasons.push("same_token_set_variant");
  }

  if (Math.min(left.compact.length, right.compact.length) >= 5) {
    const ratio = levenshteinRatio(left.compact, right.compact);
    if (ratio >= 0.9) {
      score = Math.max(score, ratio);
      reasons.push("minor_spelling_or_ocr_variant");
    }
  }

  if (!score) return null;

  const numberConflictReason = numberConflict(left, right);
  if (numberConflictReason) {
    score -= 0.2;
    reasons.push(numberConflictReason);
  }

  if (Math.max(left.compact.length, right.compact.length) <= 4 && score < 0.98) return null;
  if (score < minScore) return null;

  return {
    score: Number(score.toFixed(4)),
    reasons: Array.from(new Set(reasons)),
    left_title: left.raw,
    right_title: right.raw
  };
}

function pairCandidate(leftWork, rightWork) {
  let best = null;
  for (const left of titleVariants(leftWork)) {
    for (const right of titleVariants(rightWork)) {
      const compared = compareVariants(left, right);
      if (!compared) continue;
      if (!best || compared.score > best.score) best = compared;
    }
  }
  return best;
}

function mergeArrayValues(...arrays) {
  const out = [];
  const seen = new Set();
  for (const values of arrays) {
    for (const value of values || []) {
      if (!value) continue;
      const key = JSON.stringify(value);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

class UnionFind {
  constructor(values) {
    this.parent = new Map(values.map((value) => [value, value]));
  }

  find(value) {
    const parent = this.parent.get(value);
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent.set(value, root);
    return root;
  }

  union(left, right) {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parent.set(rightRoot, leftRoot);
  }
}

function sourcePreview(work, sourceById) {
  return (work.source_refs || [])
    .map((sourceId) => sourceById.get(sourceId))
    .filter(Boolean)
    .slice(0, 8)
    .map((source) => ({
      id: source.id,
      source: source.source || null,
      url: source.url || null,
      raw_title: source.raw_title || null,
      raw_author: source.raw_author || null
    }));
}

function scoreWork(work, editionsByWork, contributionsByWork) {
  return (
    (work.source_refs || []).length * 10 +
    (editionsByWork.get(work.id) || []).length * 5 +
    (contributionsByWork.get(work.id) || []).length +
    (work.title_bn ? 3 : 0) +
    (hasBangla(work.title_bn) ? 3 : 0) +
    (work.confidence || 0)
  );
}

function chooseLikelyCanonical(group, editionsByWork, contributionsByWork) {
  return [...group].sort((left, right) => {
    const scoreDelta = scoreWork(right, editionsByWork, contributionsByWork) - scoreWork(left, editionsByWork, contributionsByWork);
    if (scoreDelta) return scoreDelta;
    return left.id.localeCompare(right.id);
  })[0];
}

function candidateBuckets(works) {
  const buckets = new Map();
  for (const work of works) {
    const keys = new Set();
    for (const variant of titleVariants(work)) {
      if (!variant.compact) continue;
      if (variant.compact.length <= 4) {
        keys.add(`short:${variant.compact}`);
        continue;
      }
      const prefix = Array.from(variant.compact).slice(0, 3).join("");
      const lengthBand = Math.floor(Array.from(variant.compact).length / 3);
      keys.add(`${prefix}:${lengthBand}`);
      keys.add(`${prefix}:${lengthBand - 1}`);
      keys.add(`${prefix}:${lengthBand + 1}`);
    }
    for (const key of keys) {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(work);
    }
  }
  return buckets;
}

function authorMatchesFilter(author, filterKey) {
  if (!filterKey) return true;
  return authorKeys(author).includes(filterKey);
}

const authors = readJsonl(tables.authors);
const works = readJsonl(tables.works);
const editions = readJsonl(tables.editions);
const contributions = readJsonl(tables.contributions);
const sources = readJsonl(tables.sources);
const reviewedDuplicateGroupIds = new Set(
  (fs.existsSync(mainDuplicateReviewsPath) ? readJsonl(mainDuplicateReviewsPath) : [])
    .filter((review) => ["not_duplicate", "separate_works", "different_books"].includes(cleanText(review.status)))
    .map((review) => cleanText(review.review_id))
    .filter(Boolean)
);

const authorById = new Map(authors.map((author) => [author.id, author]));
const workById = new Map(works.map((work) => [work.id, work]));
const sourceById = new Map(sources.map((source) => [source.id, source]));
const editionsByWork = new Map();
const contributionsByWork = new Map();
const workIdsByAuthor = new Map();
const filterKey = normalizeText(authorFilter);

for (const edition of editions) {
  if (!editionsByWork.has(edition.work_id)) editionsByWork.set(edition.work_id, []);
  editionsByWork.get(edition.work_id).push(edition);
}

for (const contribution of contributions) {
  if (!contributionsByWork.has(contribution.work_id)) contributionsByWork.set(contribution.work_id, []);
  contributionsByWork.get(contribution.work_id).push(contribution);
  if ((contribution.role || "author") !== "author") continue;
  const author = authorById.get(contribution.author_id);
  if (!author || !authorMatchesFilter(author, filterKey)) continue;
  if (!workIdsByAuthor.has(contribution.author_id)) workIdsByAuthor.set(contribution.author_id, new Set());
  workIdsByAuthor.get(contribution.author_id).add(contribution.work_id);
}

const groups = [];
let authorsScanned = 0;
let pairCandidatesSeen = 0;

for (const [authorId, workIds] of workIdsByAuthor) {
  if (workIds.size < minAuthorWorks) continue;
  const scopedWorks = [...workIds].map((workId) => workById.get(workId)).filter(Boolean);
  if (scopedWorks.length < minAuthorWorks) continue;
  authorsScanned += 1;

  const uf = new UnionFind(scopedWorks.map((work) => work.id));
  const bestPairs = new Map();
  const seenPairs = new Set();

  for (const bucketWorks of candidateBuckets(scopedWorks).values()) {
    if (bucketWorks.length < 2) continue;
    for (let i = 0; i < bucketWorks.length; i += 1) {
      for (let j = i + 1; j < bucketWorks.length; j += 1) {
        const left = bucketWorks[i];
        const right = bucketWorks[j];
        const pairKey = [left.id, right.id].sort().join("|");
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);
        const candidate = pairCandidate(left, right);
        if (!candidate) continue;
        pairCandidatesSeen += 1;
        uf.union(left.id, right.id);
        bestPairs.set(pairKey, candidate);
      }
    }
  }

  const byRoot = new Map();
  for (const work of scopedWorks) {
    const root = uf.find(work.id);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(work);
  }

  for (const group of byRoot.values()) {
    if (group.length < 2) continue;
    const pairEvidence = [];
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const pairKey = [group[i].id, group[j].id].sort().join("|");
        const evidence = bestPairs.get(pairKey);
        if (evidence) pairEvidence.push({ left_work_id: group[i].id, right_work_id: group[j].id, ...evidence });
      }
    }
    if (!pairEvidence.length) continue;

    const author = authorById.get(authorId);
    const canonical = chooseLikelyCanonical(group, editionsByWork, contributionsByWork);
    const maxScore = Math.max(...pairEvidence.map((evidence) => evidence.score));
    const reasonCodes = mergeArrayValues(...pairEvidence.map((evidence) => evidence.reasons));
    const workSummaries = group
      .sort((left, right) => visibleTitle(left).localeCompare(visibleTitle(right), "bn") || left.id.localeCompare(right.id))
      .map((work) => ({
        id: work.id,
        title_bn: work.title_bn || null,
        title_en: work.title_en || null,
        aliases: work.aliases || [],
        first_published_year: work.first_published_year || null,
        source_ref_count: (work.source_refs || []).length,
        edition_count: (editionsByWork.get(work.id) || []).length,
        contribution_count: (contributionsByWork.get(work.id) || []).length,
        source_refs: (work.source_refs || []).slice(0, 20),
        source_previews: sourcePreview(work, sourceById)
      }));

    const reviewId = `author_title_duplicate_${hash(`${authorId}|${group.map((work) => work.id).sort().join("|")}`)}`;
    if (reviewedDuplicateGroupIds.has(reviewId)) continue;

    groups.push({
      review_id: reviewId,
      status: "needs_manual_review",
      author_id: authorId,
      author_name_bn: author?.name_bn || null,
      author_name_en: author?.name_en || null,
      author_aliases: author?.aliases || [],
      work_count_for_author: scopedWorks.length,
      likely_canonical_work_id: canonical.id,
      max_score: Number(maxScore.toFixed(4)),
      reason_codes: reasonCodes,
      pair_evidence: pairEvidence.sort((left, right) => right.score - left.score).slice(0, 20),
      works: workSummaries,
      manual_decision_hint:
        "If these are the same book, keep one work row, move all source_refs/aliases/editions/contributions to it, and keep direct source URLs as references. If they are different volumes/editions/books, mark rejected in a review note."
    });
  }
}

groups.sort((left, right) => {
  const scoreDelta = right.max_score - left.max_score;
  if (scoreDelta) return scoreDelta;
  const countDelta = right.works.length - left.works.length;
  if (countDelta) return countDelta;
  return groupAuthorVisibleName(left).localeCompare(groupAuthorVisibleName(right), "bn");
});

const selected = groups.slice(0, limit);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, selected.map((row) => JSON.stringify(row)).join("\n") + (selected.length ? "\n" : ""), "utf8");

const summary = {
  generated_at: new Date().toISOString(),
  author_filter: authorFilter || null,
  min_score: minScore,
  min_author_works: minAuthorWorks,
  authors_scanned: authorsScanned,
  pair_candidates_seen: pairCandidatesSeen,
  duplicate_groups_found: groups.length,
  groups_written: selected.length,
  output_path: path.relative(mainDir, outputPath).replaceAll("\\", "/"),
  summary_path: path.relative(mainDir, summaryPath).replaceAll("\\", "/")
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

console.log(JSON.stringify(summary, null, 2));
if (selected.length) {
  console.log("Top review groups:");
  for (const group of selected.slice(0, 20)) {
    const titles = group.works.map((work) => work.title_bn || work.title_en || work.id).join(" | ");
    console.log(`- ${group.author_name_bn || group.author_name_en || group.author_id}: ${titles} (${group.reason_codes.join(", ")})`);
  }
  if (selected.length > 20) console.log(`... ${selected.length - 20} more groups written`);
}
