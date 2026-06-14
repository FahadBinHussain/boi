const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const cheerio = require("cheerio");
const { archiveDir, generated } = require("./paths");

const sourceSlug = "rokomari-live";
const retrievedAt = process.env.DATASET_RETRIEVED_AT || new Date().toISOString().slice(0, 10);
const runId = process.env.ROKOMARI_LIVE_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(archiveDir, sourceSlug, runId);
const delayMs = Number(process.env.ROKOMARI_LIVE_DELAY_MS || 500);
const concurrency = Math.max(1, Number(process.env.ROKOMARI_LIVE_CONCURRENCY || 2));
const sitemapLimit = Number(process.env.ROKOMARI_LIVE_SITEMAP_LIMIT || 0);
const detailLimit = Number(process.env.ROKOMARI_LIVE_DETAIL_LIMIT || 0);
const minSlugScore = Number(process.env.ROKOMARI_LIVE_MIN_SLUG_SCORE || 0.92);
const maxUrlsPerCandidate = Math.max(1, Number(process.env.ROKOMARI_LIVE_MAX_URLS_PER_CANDIDATE || 2));

const sitemapMatchers = {
  product: /^\/product_urls_\d+\.xml\.gz$/i,
  author: /^\/author_urls_\d+\.xml\.gz$/i,
  publisher: /^\/publisher_urls\.xml\.gz$/i,
  category: /^\/category_urls\.xml\.gz$/i
};

const genericAuthorPattern =
  /^(?:anonymous|author|creator|darulilm|fatwaa|fatwa|unknown|not available|rasikulindia|allboi|muster a)$/i;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8211;|&#8212;|–|—/g, "-")
    .replace(/&#8216;|&#8217;|[‘’]/g, "'")
    .replace(/&#8220;|&#8221;|[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function hasBangla(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function hasLatin(value) {
  return /[A-Za-z]/.test(String(value || ""));
}

function key(value) {
  return cleanText(value)
    ?.toLowerCase()
    .normalize("NFKC")
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const stopWords = new Set(["a", "an", "and", "book", "books", "by", "pdf", "the", "o", "er"]);

function tokens(value) {
  const normalized = key(value);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return (2 * overlap) / (a.size + b.size);
}

function containsScore(a, b) {
  const left = key(a);
  const right = key(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftCount = left.split(/\s+/).filter(Boolean).length;
  const rightCount = right.split(/\s+/).filter(Boolean).length;
  const coverage = Math.min(leftCount, rightCount) / Math.max(leftCount, rightCount);
  if (coverage < 0.75) return 0;
  if (left.length >= 6 && right.includes(left)) return 0.92;
  if (right.length >= 6 && left.includes(right)) return 0.92;
  return 0;
}

function similarity(a, b) {
  if (!a || !b) return 0;
  return Math.max(containsScore(a, b), dice(new Set(tokens(a)), new Set(tokens(b))));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(filePath, rows) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");
}

function appendJsonl(filePath, row) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`, "utf8");
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function assertAllowedFetch(url) {
  const parsed = new URL(url);
  if (parsed.hostname.toLowerCase() !== "www.rokomari.com") {
    throw new Error(`Refusing to fetch unexpected host: ${url}`);
  }
  if (parsed.pathname === "/sitemap.xml") return;
  if (Object.values(sitemapMatchers).some((matcher) => matcher.test(parsed.pathname))) return;
  if (/^\/book\/\d+(?:\/|$)/i.test(parsed.pathname)) return;
  throw new Error(`Refusing to fetch non-sitemap/non-book Rokomari path: ${url}`);
}

async function fetchResponse(url, options = {}) {
  assertAllowedFetch(url);
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(Number(options.timeoutMs || process.env.ROKOMARI_LIVE_FETCH_TIMEOUT_MS || 45000)),
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 boi-dataset-scrape",
          accept: options.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "bn,en-US;q=0.9,en;q=0.8",
          "cache-control": "no-cache"
        }
      });
      assertAllowedFetch(response.url || url);
      if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(750 * attempt);
    }
  }
  throw lastError;
}

async function fetchText(url, options = {}) {
  const response = await fetchResponse(url, options);
  return {
    text: await response.text(),
    status: response.status,
    final_url: response.url || url,
    headers: Object.fromEntries(response.headers.entries())
  };
}

async function fetchGzipText(url) {
  const response = await fetchResponse(url, { accept: "application/xml,application/gzip,*/*;q=0.8" });
  const buffer = Buffer.from(await response.arrayBuffer());
  let text;
  try {
    text = zlib.gunzipSync(buffer).toString("utf8");
  } catch {
    text = buffer.toString("utf8");
  }
  return {
    text,
    status: response.status,
    final_url: response.url || url,
    headers: Object.fromEntries(response.headers.entries())
  };
}

function sitemapKind(url) {
  const pathname = new URL(url).pathname;
  for (const [kind, matcher] of Object.entries(sitemapMatchers)) {
    if (matcher.test(pathname)) return kind;
  }
  return null;
}

function parseSitemapIndex(xml) {
  return Array.from(String(xml || "").matchAll(/<loc>\s*([^<]+)\s*<\/loc>/giu))
    .map((match) => cleanText(match[1]))
    .filter(Boolean)
    .map((url) => ({ url, kind: sitemapKind(url) }))
    .filter((entry) => entry.kind);
}

function parseUrlset(xml) {
  const entries = [];
  for (const match of String(xml || "").matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/giu)) {
    const block = match[1];
    const loc = cleanText(block.match(/<loc>\s*([^<]+)\s*<\/loc>/iu)?.[1]);
    if (!loc) continue;
    entries.push({
      url: loc,
      lastmod: cleanText(block.match(/<lastmod>\s*([^<]+)\s*<\/lastmod>/iu)?.[1])
    });
  }
  return entries;
}

function productIdFromUrl(url) {
  return String(url || "").match(/\/book\/(\d+)(?:\/|$)/i)?.[1] || null;
}

function slugFromUrl(url) {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (parts[0] !== "book" || !parts[2]) return null;
    return decodeURIComponent(parts.slice(2).join(" ")).replace(/[-_]+/g, " ");
  } catch {
    return null;
  }
}

function entityIdFromUrl(url, prefix) {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const index = parts.indexOf(prefix);
    return index >= 0 ? parts[index + 1] || null : null;
  } catch {
    return null;
  }
}

function candidateAuthors(candidate) {
  return (candidate.authors || [])
    .map((author) => cleanText(author.name_bn || author.name_en))
    .filter(Boolean)
    .filter((author) => !genericAuthorPattern.test(author));
}

function candidateTitleVariants(candidate) {
  return [candidate.title_en, candidate.title_bn, ...(candidate.sources || []).map((source) => source.raw_title)]
    .map(cleanText)
    .filter(Boolean)
    .filter((value) => hasLatin(value) || hasBangla(value));
}

function loadCandidateQueue() {
  return readJsonl(generated.candidateBooks)
    .filter((candidate) => hasBangla(candidate.title_bn || candidate.title_en))
    .filter((candidate) => (candidate.reason || "").includes("Internet Archive is the only source reference"))
    .filter((candidate) => candidateAuthors(candidate).length > 0)
    .map((candidate) => ({
      work_id: candidate.normalized_work_id,
      title_bn: candidate.title_bn || null,
      title_en: candidate.title_en || null,
      authors: candidateAuthors(candidate),
      title_variants: candidateTitleVariants(candidate)
    }));
}

function buildBookUrlIndex(bookUrls) {
  const byToken = new Map();
  for (const row of bookUrls) {
    row.slug_key = key(row.slug);
    row.slug_tokens = tokens(row.slug);
    for (const token of new Set(row.slug_tokens)) {
      const list = byToken.get(token) || [];
      list.push(row);
      byToken.set(token, list);
    }
  }

  const tooCommonThreshold = Math.max(1000, Math.floor(bookUrls.length * 0.02));
  const ignoredTokens = new Set(
    Array.from(byToken.entries())
      .filter(([, rows]) => rows.length > tooCommonThreshold)
      .map(([token]) => token)
  );
  return { byToken, ignoredTokens };
}

function candidateUrlPool(candidate, index) {
  const pool = new Set();
  for (const variant of candidate.title_variants) {
    for (const token of tokens(variant)) {
      if (index.ignoredTokens.has(token)) continue;
      for (const row of index.byToken.get(token) || []) pool.add(row);
    }
  }
  return Array.from(pool);
}

function bestCandidateUrlMatches(candidates, bookUrls) {
  const index = buildBookUrlIndex(bookUrls);
  const matchesByUrl = new Map();
  for (const candidate of candidates) {
    const scored = [];
    for (const row of candidateUrlPool(candidate, index)) {
      const score = Math.max(...candidate.title_variants.map((title) => similarity(title, row.slug)), 0);
      if (score >= minSlugScore) scored.push({ row, score });
    }
    scored.sort((a, b) => b.score - a.score || Number(a.row.product_id) - Number(b.row.product_id));
    for (const match of scored.slice(0, maxUrlsPerCandidate)) {
      const current = matchesByUrl.get(match.row.url) || {
        ...match.row,
        candidate_matches: []
      };
      current.candidate_matches.push({
        work_id: candidate.work_id,
        title_bn: candidate.title_bn,
        title_en: candidate.title_en,
        authors: candidate.authors,
        slug_score: Math.round(match.score * 1000) / 1000
      });
      matchesByUrl.set(match.row.url, current);
    }
  }
  return Array.from(matchesByUrl.values()).slice(0, detailLimit || undefined);
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

function parseYear(value) {
  const match = String(value || "").match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function parsePages(value) {
  const normalized = String(value || "").replace(/[০-৯]/g, (digit) => "০১২৩৪৫৬৭৮৯".indexOf(digit));
  const match = normalized.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function parseProduct(html, urlRow) {
  const $ = cheerio.load(html);
  const specs = parseSpecTable($);
  const authorLink = $(".details-book-main-info").first().find('a[href*="/book/author/"]').first();
  const authorHref = authorLink.attr("href");
  const publisherLink = $('.details-book-main-info a[href*="/book/publisher/"], .details-book-additional-info a[href*="/book/publisher/"]').first();
  const publisherHref = publisherLink.attr("href");
  return {
    source: "Rokomari",
    retrieved_at: retrievedAt,
    product_id: urlRow.product_id,
    url: urlRow.url,
    sitemap_url: urlRow.sitemap_url,
    sitemap_lastmod: urlRow.lastmod || null,
    slug: urlRow.slug,
    candidate_matches: urlRow.candidate_matches || [],
    title: cleanText(specs.title) || cleanText($("h1").first().text()) || cleanText($("meta[property='og:title']").attr("content")),
    title_en: cleanText($("#js--product-en-name").attr("value")),
    contributors: [
      {
        name:
          cleanText(specs.author) ||
          cleanText(authorLink.text()) ||
          cleanText($("#js--product-author-name").attr("value")),
        role: "author"
      }
    ].filter((contributor) => contributor.name),
    author_bn: cleanText(specs.author) || cleanText(authorLink.text()),
    author_en: cleanText($("#js--product-author-name").attr("value")),
    author_id: entityIdFromUrl(authorHref, "author"),
    publisher: cleanText(specs.publisher) || cleanText(publisherLink.text()),
    publisher_id: entityIdFromUrl(publisherHref, "publisher"),
    isbn: cleanText(specs.isbn),
    edition: cleanText(specs.edition),
    publication_year: parseYear(specs.edition),
    pages: parsePages(specs["number of pages"]),
    language: cleanText(specs.language),
    page_title: cleanText($("title").first().text())
  };
}

async function mapLimit(items, workerCount, handler) {
  let index = 0;
  const workers = Array.from({ length: workerCount }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await handler(items[current], current);
      if (delayMs) await sleep(delayMs);
    }
  });
  await Promise.all(workers);
}

async function main() {
  ensureDir(runDir);
  const errorsPath = path.join(runDir, "errors.jsonl");
  const sitemapText = await fetchText("https://www.rokomari.com/sitemap.xml", { accept: "application/xml,*/*;q=0.8" });
  const sitemapEntries = parseSitemapIndex(sitemapText.text).slice(0, sitemapLimit || undefined);
  const sitemaps = [];
  const bookUrls = [];
  const authorUrls = [];
  const publisherUrls = [];
  const categoryUrls = [];

  for (const sitemap of sitemapEntries) {
    try {
      const fetched = await fetchGzipText(sitemap.url);
      const rows = parseUrlset(fetched.text);
      sitemaps.push({
        kind: sitemap.kind,
        url: sitemap.url,
        final_url: fetched.final_url,
        url_count: rows.length,
        retrieved_at: retrievedAt
      });
      for (const row of rows) {
        if (sitemap.kind === "product") {
          const productId = productIdFromUrl(row.url);
          if (!productId) continue;
          bookUrls.push({
            source: "Rokomari sitemap",
            retrieved_at: retrievedAt,
            product_id: productId,
            url: row.url,
            slug: slugFromUrl(row.url),
            lastmod: row.lastmod || null,
            sitemap_url: sitemap.url
          });
        }
        if (sitemap.kind === "author") authorUrls.push({ ...row, source: "Rokomari author sitemap", retrieved_at: retrievedAt, sitemap_url: sitemap.url });
        if (sitemap.kind === "publisher") publisherUrls.push({ ...row, source: "Rokomari publisher sitemap", retrieved_at: retrievedAt, sitemap_url: sitemap.url });
        if (sitemap.kind === "category") categoryUrls.push({ ...row, source: "Rokomari category sitemap", retrieved_at: retrievedAt, sitemap_url: sitemap.url });
      }
      console.log(`[sitemap] ${sitemap.kind} ${sitemap.url} ${rows.length}`);
    } catch (error) {
      appendJsonl(errorsPath, { stage: "sitemap", url: sitemap.url, error: error.message });
    }
    if (delayMs) await sleep(delayMs);
  }

  writeJsonl(path.join(runDir, "sitemaps.jsonl"), sitemaps);
  writeJsonl(path.join(runDir, "book-urls.jsonl"), bookUrls);
  writeJsonl(path.join(runDir, "author-urls.jsonl"), authorUrls);
  writeJsonl(path.join(runDir, "publisher-urls.jsonl"), publisherUrls);
  writeJsonl(path.join(runDir, "category-urls.jsonl"), categoryUrls);

  const candidates = loadCandidateQueue();
  const detailTargets = bestCandidateUrlMatches(candidates, bookUrls);
  writeJsonl(path.join(runDir, "detail-targets.jsonl"), detailTargets);

  const books = [];
  await mapLimit(detailTargets, concurrency, async (target, index) => {
    try {
      const fetched = await fetchText(target.url);
      books.push(parseProduct(fetched.text, target));
      console.log(`[detail ${index + 1}/${detailTargets.length}] ${target.product_id}`);
    } catch (error) {
      appendJsonl(errorsPath, { stage: "book-detail", url: target.url, product_id: target.product_id, error: error.message });
    }
  });

  books.sort((a, b) => Number(a.product_id) - Number(b.product_id));
  writeJsonl(path.join(runDir, "books.jsonl"), books);
  const errors = readJsonl(errorsPath);
  writeJson(path.join(runDir, "manifest.json"), {
    run_id: runId,
    source: sourceSlug,
    retrieved_at: retrievedAt,
    notes:
      "Rokomari live scrape from the public sitemap index and public /book/ detail pages only. /search is intentionally not used because robots.txt disallows it.",
    counts: {
      sitemaps: sitemaps.length,
      book_urls: bookUrls.length,
      author_urls: authorUrls.length,
      publisher_urls: publisherUrls.length,
      category_urls: categoryUrls.length,
      candidate_queue: candidates.length,
      detail_targets: detailTargets.length,
      detail_records: books.length,
      errors: errors.length
    }
  });
  console.log(
    JSON.stringify(
      {
        run_id: runId,
        book_urls: bookUrls.length,
        candidate_queue: candidates.length,
        detail_targets: detailTargets.length,
        detail_records: books.length,
        errors: errors.length
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
