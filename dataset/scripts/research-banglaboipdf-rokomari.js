const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { archiveDir, tables } = require("./paths");
const { readJsonl } = require("./jsonl-store");

const sourceName = "BanglaBoiPDF";
const supportSource = "Rokomari";
const runId = process.env.BANGLABOIPDF_RUN_ID || null;
const reconcileId = process.env.BANGLABOIPDF_RECONCILE_ID || null;
const researchId = process.env.BANGLABOIPDF_ROKOMARI_RESEARCH_ID || new Date().toISOString().replace(/[:.]/g, "-");
const limit = Number(process.env.BANGLABOIPDF_ROKOMARI_LIMIT || 100);
const offset = Number(process.env.BANGLABOIPDF_ROKOMARI_OFFSET || 0);
const delayMs = Number(process.env.BANGLABOIPDF_ROKOMARI_DELAY_MS || 450);
const maxCards = Number(process.env.BANGLABOIPDF_ROKOMARI_MAX_CARDS || 4);
const fetchTimeoutMs = Number(process.env.BANGLABOIPDF_ROKOMARI_FETCH_TIMEOUT_MS || 20000);
const skipPreviouslyResearched = process.env.BANGLABOIPDF_ROKOMARI_SKIP_RESEARCHED === "1";
const authorFilter = new Set(
  (process.env.BANGLABOIPDF_ROKOMARI_AUTHORS || "")
    .split(",")
    .map((value) => cleanText(value))
    .filter(Boolean)
);
const sourceIdFilter = new Set(
  (process.env.BANGLABOIPDF_ROKOMARI_SOURCE_IDS || "")
    .split(",")
    .map((value) => cleanText(value))
    .filter(Boolean)
);
const productUrlHints = (process.env.BANGLABOIPDF_ROKOMARI_PRODUCT_URLS || "")
  .split(",")
  .map((value) => cleanText(value))
  .filter(Boolean);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(filePath, rows) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s'",]+|[\s'",]+$/g, "")
    .trim();
  return text || null;
}

function unique(values) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function hasBangla(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function key(value) {
  return cleanText(value)
    ?.toLowerCase()
    .normalize("NFKC")
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function romanKey(value) {
  return key(value)
    ?.replace(/\bd[ao]shti\b/g, "dashti")
    .replace(/\bdosti\b/g, "dashti")
    .replace(/\bupon+as(?:h)?\b/g, "upanyas")
    .replace(/\bupannas(?:h)?\b/g, "upanyas")
    .replace(/\bsh/g, "s")
    .replace(/sh\b/g, "s")
    .replace(/ng/g, "n")
    .replace(/kh/g, "k")
    .replace(/gh/g, "g")
    .replace(/ph/g, "f")
    .replace(/bh/g, "b")
    .replace(/ch/g, "c")
    .replace(/y/g, "i")
    .replace(/aa+/g, "a")
    .replace(/ee+/g, "i")
    .replace(/oo+/g, "u")
    .replace(/\s+/g, " ")
    .trim();
}

const authorStopWords = new Set([
  "al",
  "dr",
  "hazrat",
  "hazarat",
  "hzt",
  "islam",
  "maolana",
  "maulana",
  "mawlana",
  "molana",
  "moulana",
  "prof",
  "professor",
  "ra",
  "rah",
  "shaikh",
  "sheikh",
  "shaiykh"
]);

function canonicalAuthorToken(token) {
  return token
    .replace(/^sayy?id$/, "syed")
    .replace(/^saiyid$/, "syed")
    .replace(/^sayyid$/, "syed")
    .replace(/^bandyopadhyay$/, "bandyopadhyay")
    .replace(/^banerjee$/, "bandyopadhyay")
    .replace(/^chatterjee$/, "chattopadhyay")
    .replace(/^muham+ad$/, "muhammad")
    .replace(/^moham+ad$/, "muhammad")
    .replace(/^muham+od$/, "muhammad")
    .replace(/^moham+od$/, "muhammad");
}

function authorKey(value) {
  const normalized = romanKey(value);
  if (!normalized) return null;
  return normalized
    .split(/\s+/)
    .map((token) => canonicalAuthorToken(token))
    .filter((token) => token.length > 1 && !authorStopWords.has(token))
    .join(" ");
}

const stopWords = new Set(["a", "an", "and", "bangla", "bengali", "book", "boi", "by", "ebook", "pdf", "the", "o", "er"]);
const genericAuthorPattern = /\b(?:author|authors|various|various writers?|various author|unknown|compiled|collection)\b/i;

function tokens(value, normalizer = key) {
  const normalized = normalizer(value);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function tokenSet(value, normalizer = key) {
  return new Set(tokens(value, normalizer));
}

function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return (2 * overlap) / (a.size + b.size);
}

function containsScore(a, b, normalizer = key) {
  const left = normalizer(a);
  const right = normalizer(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftTokenCount = left.split(/\s+/).filter(Boolean).length;
  const rightTokenCount = right.split(/\s+/).filter(Boolean).length;
  const coverage = Math.min(leftTokenCount, rightTokenCount) / Math.max(leftTokenCount, rightTokenCount);
  const score = coverage >= 0.75 ? 0.92 : 0.72;
  if (left.length >= 6 && right.includes(left)) return score;
  if (right.length >= 6 && left.includes(right)) return score;
  return 0;
}

function similarity(a, b) {
  if (!a || !b) return 0;
  return Math.max(
    containsScore(a, b),
    dice(tokenSet(a), tokenSet(b)),
    containsScore(a, b, romanKey),
    dice(tokenSet(a, romanKey), tokenSet(b, romanKey))
  );
}

function authorSimilarity(a, b) {
  if (!a || !b) return 0;
  const baseScore = similarity(a, b);
  const left = tokens(a, authorKey);
  const right = tokenSet(b, authorKey);
  if (!left.length || !right.size) return baseScore;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  if (overlap < 2) return Math.min(baseScore, 0.4);
  const coverage = overlap / left.length;
  const coverageScore = coverage >= 0.8 ? 0.95 : coverage >= 0.6 ? 0.75 : 0;
  return Math.max(baseScore, coverageScore);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGenericAuthor(value) {
  const text = cleanText(value);
  return !text || genericAuthorPattern.test(text);
}

function usableAuthors(record) {
  return unique(record.authors || []).filter((author) => !isGenericAuthor(author));
}

function cleanQueryTitle(value) {
  const text = cleanText(value);
  if (!text) return null;
  return cleanText(
    text
      .replace(/\b(?:bangla|bengali)\s+(?:ebook|book)\s+pdf\b/gi, " ")
      .replace(/\b(?:ebook|book)\s+pdf\b/gi, " ")
      .replace(/\bpdf\b/gi, " ")
  );
}

function searchQueriesFor(record) {
  const titles = unique([...(record.title_variants || []), record.title, record.source_title, record.raw_title].map(cleanQueryTitle));
  const authors = usableAuthors(record);
  const primaryAuthor = authors[0] || "";
  const queries = [];
  for (const title of titles) {
    if (primaryAuthor) queries.push(`${title} ${primaryAuthor}`.trim());
    queries.push(title);
  }
  return unique(queries).slice(0, 8);
}

function latestRunDir() {
  const root = path.join(archiveDir, "banglaboipdf");
  const runs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, "books.jsonl")))
    .map((entry) => ({
      name: entry.name,
      dir: path.join(root, entry.name),
      mtime: fs.statSync(path.join(root, entry.name, "books.jsonl")).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!runs.length) throw new Error(`No ${sourceName} archive run found in ${root}`);
  return runs[0];
}

function selectedRunDir() {
  if (!runId) return latestRunDir();
  const dir = path.join(archiveDir, "banglaboipdf", runId);
  if (!fs.existsSync(path.join(dir, "books.jsonl"))) throw new Error(`No books.jsonl in ${dir}`);
  return { name: runId, dir };
}

function latestReconciliationDir(runDir) {
  const root = path.join(runDir, "reconciliation");
  const runs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, "not_found_in_main.jsonl")))
    .map((entry) => ({
      name: entry.name,
      dir: path.join(root, entry.name),
      mtime: fs.statSync(path.join(root, entry.name, "manifest.json")).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!runs.length) throw new Error(`No reconciliation run found in ${root}`);
  return runs[0];
}

function selectedReconciliationDir(runDir) {
  if (!reconcileId) return latestReconciliationDir(runDir);
  const dir = path.join(runDir, "reconciliation", reconcileId);
  const filePath = path.join(dir, "not_found_in_main.jsonl");
  if (!fs.existsSync(filePath)) throw new Error(`No not_found_in_main.jsonl in ${dir}`);
  return { name: reconcileId, dir };
}

function previouslyResearchedSourceIds(runDir) {
  if (!skipPreviouslyResearched) return new Set();
  const root = path.join(runDir, "rokomari-research");
  if (!fs.existsSync(root)) return new Set();
  const ids = new Set();
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === researchId) continue;
    const filePath = path.join(root, entry.name, "items.jsonl");
    for (const item of readJsonl(filePath)) {
      if (item.source_id && item.status !== "research_error") ids.add(String(item.source_id));
    }
  }
  return ids;
}

function loadSourceRecordsById(runDir) {
  const records = readJsonl(path.join(runDir, "books.jsonl"));
  return new Map(records.map((record) => [String(record.source_id), record]));
}

function parseRokomariId(urlOrPath) {
  const match = String(urlOrPath || "").match(/\/book\/(\d+)(?:\/|$)/);
  return match ? match[1] : null;
}

function absoluteRokomariUrl(href) {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  return `https://www.rokomari.com${href.startsWith("/") ? "" : "/"}${href}`;
}

async function fetchText(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9,bn;q=0.8",
          "cache-control": "no-cache"
        }
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
      return text;
    } catch (error) {
      lastError = error.name === "AbortError" ? new Error(`Fetch timed out after ${fetchTimeoutMs}ms: ${url}`) : error;
      if (attempt < 3) await sleep(750 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function searchUrl(query) {
  const url = new URL("https://www.rokomari.com/search");
  url.searchParams.set("term", query);
  return url.toString();
}

function hintedProductCards() {
  return productUrlHints
    .map((url) => ({
      product_id: parseRokomariId(url),
      url: absoluteRokomariUrl(url),
      title_bn: null,
      author_bn: null,
      href: url
    }))
    .filter((card) => card.product_id);
}

function parseSearchCards(html) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const cards = [];
  $(".product-card-wrapper").each((_, node) => {
    const href = $(node).find('a[href*="/book/"]').first().attr("href");
    const productId = parseRokomariId(href);
    if (!href || !productId || seen.has(productId)) return;
    seen.add(productId);
    cards.push({
      product_id: productId,
      url: absoluteRokomariUrl(href),
      title_bn: cleanText($(node).find(".book-title").first().text()),
      author_bn: cleanText($(node).find(".book-author").first().text()),
      href
    });
  });
  return cards;
}

function parseSpecTable($) {
  const specs = {};
  $(".details-book-additional-info table tr, .details-book-additional-info .table tr").each((_, row) => {
    const cells = $(row)
      .find("td,th")
      .map((__, cell) => cleanText($(cell).text()))
      .get()
      .filter(Boolean);
    if (cells.length >= 2) specs[key(cells[0]) || cells[0].toLowerCase()] = cells.slice(1).join(" ");
  });
  return specs;
}

function specField(specs, labels) {
  for (const label of labels) {
    const value = specs[key(label)];
    if (value) return cleanText(value);
  }
  return null;
}

function parseYear(value) {
  const match = String(value || "").match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function parsePages(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function parseProduct(html, fallbackCard) {
  const $ = cheerio.load(html);
  const specs = parseSpecTable($);
  const authorLink = $(".details-book-main-info").first().find('a[href*="/book/author/"]').first();
  const authorHref = cleanText(authorLink.attr("href"));
  const authorId = authorHref?.match(/\/book\/author\/(\d+)/)?.[1] || null;
  const titleBn = specField(specs, ["title", "নাম"]) || cleanText($("h1").first().text()) || fallbackCard.title_bn;

  return {
    product_id: fallbackCard.product_id,
    url: fallbackCard.url,
    title_bn: titleBn,
    title_en: cleanText($("#js--product-en-name").attr("value")),
    author_bn: specField(specs, ["author", "লেখক"]) || cleanText(authorLink.text()) || fallbackCard.author_bn,
    author_en: cleanText($("#js--product-author-name").attr("value")),
    author_id: authorId,
    translator: specField(specs, ["translator", "translated by", "অনুবাদক"]),
    editor: specField(specs, ["editor", "edited by", "সম্পাদক"]),
    category_bn: cleanText($(".details-book-info__content-category a").first().text()),
    category_en: cleanText($("#js--product-category-name").attr("value")),
    publisher: specField(specs, ["publisher", "প্রকাশনী"]),
    isbn: specField(specs, ["isbn"]),
    edition: specField(specs, ["edition", "সংস্করণ"]),
    publication_year: parseYear(specField(specs, ["edition", "publication", "published"])),
    pages: parsePages(specField(specs, ["number of pages", "pages", "পৃষ্ঠা"])),
    country: specField(specs, ["country", "দেশ"]),
    language: specField(specs, ["language", "ভাষা"]),
    page_title: cleanText($("title").first().text())
  };
}

function scoreProduct(record, product) {
  const authors = usableAuthors(record);
  const titleCandidates = [product.title_bn, product.title_en, product.url, product.page_title].filter(Boolean);
  const sourceTitles = unique([...(record.title_variants || []), record.title, record.source_title, record.raw_title]);
  const authorCandidates = [product.author_en, product.author_bn, product.translator, product.editor].filter(Boolean);
  const exactTitleMatch = sourceTitles.some((title) => titleCandidates.some((value) => key(title) && key(title) === key(value)));
  const titleScore = Math.max(...sourceTitles.flatMap((title) => titleCandidates.map((value) => similarity(title, value))), 0);
  const authorScore = Math.max(
    ...authors.flatMap((author) => authorCandidates.map((value) => authorSimilarity(author, value))),
    0
  );
  const totalScore = Math.round((titleScore * 0.74 + authorScore * 0.26) * 1000) / 1000;
  return {
    title_score: Math.round(titleScore * 1000) / 1000,
    author_score: Math.round(authorScore * 1000) / 1000,
    total_score: totalScore,
    source_author_count: authors.length,
    exact_title_match: exactTitleMatch
  };
}

function isAccepted(product, scores) {
  if (!product.title_bn || !hasBangla(product.title_bn)) return false;
  if (!product.author_bn || !hasBangla(product.author_bn)) return false;
  if (scores.source_author_count === 0) return scores.exact_title_match && scores.title_score >= 0.98;
  if (scores.exact_title_match && scores.author_score >= 0.55) return true;
  if (scores.title_score >= 0.92 && scores.author_score >= 0.55) return true;
  return scores.title_score >= 0.98 && scores.author_score > 0.4;
}

function hasStrongAcceptedCandidate(candidates) {
  return candidates.some(
    (candidate) => candidate.accepted && candidate.scores.title_score >= 0.95 && (candidate.scores.author_score >= 0.55 || candidate.scores.source_author_count === 0)
  );
}

function buildMainIndex() {
  const sources = readJsonl(tables.sources);
  const works = readJsonl(tables.works);
  const editions = readJsonl(tables.editions);
  const authors = readJsonl(tables.authors);
  const contributions = readJsonl(tables.contributions);
  const sourceIdsByProductId = new Map();
  const workIdBySourceId = new Map();
  const authorById = new Map(authors.map((author) => [author.id, author]));
  const contributionAuthorsByWorkId = new Map();

  for (const source of sources) {
    const productId = parseRokomariId(source.url) || (source.id || "").match(/^source_rokomari_book_(\d+)$/)?.[1] || null;
    if (!productId) continue;
    const list = sourceIdsByProductId.get(productId) || [];
    list.push(source.id);
    sourceIdsByProductId.set(productId, list);
  }

  for (const work of works) {
    for (const sourceId of work.source_refs || []) {
      workIdBySourceId.set(sourceId, work.id);
    }
  }

  for (const edition of editions) {
    for (const sourceId of edition.source_refs || []) {
      if (!workIdBySourceId.has(sourceId)) workIdBySourceId.set(sourceId, edition.work_id);
    }
  }

  for (const contribution of contributions) {
    const author = authorById.get(contribution.author_id);
    const list = contributionAuthorsByWorkId.get(contribution.work_id) || [];
    list.push(author?.name_bn || author?.name_en || contribution.author_id);
    contributionAuthorsByWorkId.set(contribution.work_id, list);
  }

  return {
    sourceIdsByProductId,
    workIdBySourceId,
    contributionAuthorsByWorkId
  };
}

function existingMainMatch(product, mainIndex) {
  const sourceIds = mainIndex.sourceIdsByProductId.get(product.product_id) || [];
  for (const sourceId of sourceIds) {
    const workId = mainIndex.workIdBySourceId.get(sourceId);
    if (workId) {
      return {
        source_id: sourceId,
        work_id: workId,
        author_names: mainIndex.contributionAuthorsByWorkId.get(workId) || []
      };
    }
  }
  return null;
}

function sourcePayload(record, archiveRecord) {
  return {
    title: record.title,
    title_variants: record.title_variants || [],
    raw_title: record.raw_title,
    source_title: record.source_title,
    authors: record.authors || [],
    source_author: record.source_author,
    editor_or_translator: record.editor_or_translator,
    url: record.url,
    categories: record.categories || [],
    tags: record.tags || [],
    pages: record.pages || null,
    pdf_size: record.pdf_size || null,
    cover_url: record.cover_url || null,
    flags: record.flags || {},
    archive_record: archiveRecord || null
  };
}

function statusCounts(items) {
  const counts = {};
  for (const item of items) counts[item.status] = (counts[item.status] || 0) + 1;
  return counts;
}

function writeRunFiles(outDir, manifestBase, items, partial) {
  writeJsonl(path.join(outDir, "items.jsonl"), items);
  writeJson(path.join(outDir, "manifest.json"), {
    ...manifestBase,
    checked_at: new Date().toISOString(),
    partial,
    counts: {
      checked: items.length,
      ...statusCounts(items)
    }
  });
}

async function researchRecord(record, archiveRecord, mainIndex) {
  const queries = searchQueriesFor(record);
  const seenProductIds = new Set();
  const candidates = [];

  for (const card of hintedProductCards()) {
    if (seenProductIds.has(card.product_id)) continue;
    seenProductIds.add(card.product_id);
    const productHtml = await fetchText(card.url);
    const product = parseProduct(productHtml, card);
    const scores = scoreProduct(record, product);
    candidates.push({
      product,
      scores,
      accepted: isAccepted(product, scores),
      existing_main: existingMainMatch(product, mainIndex)
    });
  }

  if (hasStrongAcceptedCandidate(candidates)) {
    candidates.sort((a, b) => b.scores.total_score - a.scores.total_score);
    const best = candidates[0];
    return {
      source: sourceName,
      support_source: supportSource,
      source_id: record.source_id,
      banglaboipdf: sourcePayload(record, archiveRecord),
      status: best.existing_main ? "verified_existing_main" : "verified_new_main",
      best_match: best,
      candidates: candidates.slice(0, maxCards),
      searched_queries: queries,
      product_url_hints: productUrlHints
    };
  }

  for (const query of queries) {
    const url = searchUrl(query);
    const html = await fetchText(url);
    const cards = parseSearchCards(html).slice(0, maxCards);
    for (const card of cards) {
      if (seenProductIds.has(card.product_id)) continue;
      seenProductIds.add(card.product_id);
      await sleep(delayMs);
      const productHtml = await fetchText(card.url);
      const product = parseProduct(productHtml, card);
      const scores = scoreProduct(record, product);
      candidates.push({
        product,
        scores,
        accepted: isAccepted(product, scores),
        existing_main: existingMainMatch(product, mainIndex)
      });
    }
    if (hasStrongAcceptedCandidate(candidates)) break;
    await sleep(delayMs);
  }

  candidates.sort((a, b) => b.scores.total_score - a.scores.total_score);
  const accepted = candidates
    .filter((candidate) => candidate.accepted)
    .sort((a, b) => {
      const aRank = a.scores.total_score + (a.existing_main ? 0.05 : 0);
      const bRank = b.scores.total_score + (b.existing_main ? 0.05 : 0);
      return bRank - aRank;
    });
  const best = accepted[0] || candidates[0] || null;
  let status = "no_rokomari_match";
  if (!best?.existing_main && accepted.length > 1 && accepted[1].scores.total_score >= best.scores.total_score - 0.03) status = "ambiguous_rokomari_match";
  else if (best?.accepted) status = best.existing_main ? "verified_existing_main" : "verified_new_main";

  return {
    source: sourceName,
    support_source: supportSource,
    source_id: record.source_id,
    banglaboipdf: sourcePayload(record, archiveRecord),
    status,
    best_match: best || null,
    candidates: candidates.slice(0, maxCards),
    searched_queries: queries,
    product_url_hints: productUrlHints
  };
}

async function main() {
  const run = selectedRunDir();
  const reconciliation = selectedReconciliationDir(run.dir);
  const outDir = path.join(run.dir, "rokomari-research", researchId);
  const archiveRecords = loadSourceRecordsById(run.dir);
  const mainIndex = buildMainIndex();
  const researchedSourceIds = previouslyResearchedSourceIds(run.dir);
  const existingItems = readJsonl(path.join(outDir, "items.jsonl"));
  const existingItemIds = new Set(existingItems.map((item) => String(item.source_id)));
  const rows = readJsonl(path.join(reconciliation.dir, "not_found_in_main.jsonl"));
  const queue = rows
    .filter((row) => (sourceIdFilter.size ? sourceIdFilter.has(String(row.source_id)) : true))
    .filter((row) => (authorFilter.size ? authorFilter.has((row.authors || [])[0]) : true))
    .filter((row) => !researchedSourceIds.has(String(row.source_id)))
    .filter((row) => !existingItemIds.has(String(row.source_id)))
    .slice(offset, offset + limit);

  const manifestBase = {
    source: sourceName,
    support_source: supportSource,
    run_id: run.name,
    reconciliation_id: reconciliation.name,
    research_id: researchId,
    config: {
      limit,
      offset,
      author_filter: Array.from(authorFilter),
      source_id_filter: Array.from(sourceIdFilter),
      product_url_hints: productUrlHints,
      delay_ms: delayMs,
      fetch_timeout_ms: fetchTimeoutMs,
      max_cards: maxCards,
      skip_previously_researched: skipPreviouslyResearched,
      skipped_previously_researched: researchedSourceIds.size,
      resumed_items: existingItems.length
    },
    interpretation: {
      verified_existing_main: "Rokomari page verifies the BanglaBoiPDF row and already maps to an existing main work; safe for source-link enrichment",
      verified_new_main: "Rokomari page verifies a Bangla title/author not already mapped by Rokomari product id; apply still checks title+author duplicates before creating a new main work",
      ambiguous_rokomari_match: "multiple close Rokomari matches; keep in archive",
      no_rokomari_match: "no strong Rokomari page match; keep in archive",
      research_error: "network or parser issue; rerun later"
    },
    output_files: {
      items: path.relative(archiveDir, path.join(outDir, "items.jsonl")).replaceAll("\\", "/"),
      manifest: path.relative(archiveDir, path.join(outDir, "manifest.json")).replaceAll("\\", "/")
    }
  };

  const items = [...existingItems];
  writeRunFiles(outDir, manifestBase, items, true);
  for (const [index, row] of queue.entries()) {
    console.log(`[${index + 1}/${queue.length}] ${row.title} - ${(row.authors || []).join("; ") || "title-only"}`);
    try {
      items.push(await researchRecord(row, archiveRecords.get(String(row.source_id)), mainIndex));
    } catch (error) {
      items.push({
        source: sourceName,
        support_source: supportSource,
        source_id: row.source_id,
        banglaboipdf: sourcePayload(row, archiveRecords.get(String(row.source_id))),
        status: "research_error",
        error: error.message
      });
    }
    writeRunFiles(outDir, manifestBase, items, true);
    await sleep(delayMs);
  }

  writeRunFiles(outDir, manifestBase, items, false);
  const manifest = {
    ...manifestBase,
    checked_at: new Date().toISOString(),
    partial: false,
    counts: {
      checked: items.length,
      ...statusCounts(items)
    }
  };
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
