const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { archiveDir } = require("./paths");

const sourceSlug = "granthagara";
const retrievedAt = process.env.DATASET_RETRIEVED_AT || new Date().toISOString().slice(0, 10);
const runId = process.env.GRANTHAGARA_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(archiveDir, sourceSlug, runId);
const delayMs = Number(process.env.GRANTHAGARA_DELAY_MS || 100);
const concurrency = Math.max(1, Number(process.env.GRANTHAGARA_CONCURRENCY || 6));
const limit = Number(process.env.GRANTHAGARA_LIMIT || 0);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function unique(values) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function numberFromText(value) {
  const normalized = String(value || "").replace(/[০-৯]/g, (digit) => "০১২৩৪৫৬৭৮৯".indexOf(digit));
  const match = normalized.replace(/,/g, "").match(/\b\d+\b/);
  return match ? Number(match[0]) : null;
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
  const host = parsed.hostname.toLowerCase();
  if (!["granthagara.com", "www.granthagara.com"].includes(host)) {
    throw new Error(`Refusing to fetch unexpected host: ${url}`);
  }
  if (/\.(?:pdf|epub|mobi|doc|docx|zip|rar|7z)(?:$|\?)/i.test(parsed.pathname)) {
    throw new Error(`Refusing to fetch file endpoint: ${url}`);
  }
  if (/\/(?:wp-admin|wp-login|feed|comments|cart|checkout|account)(?:\/|$)/i.test(parsed.pathname)) {
    throw new Error(`Refusing to fetch admin/feed/account endpoint: ${url}`);
  }
}

async function fetchText(url, options = {}) {
  assertAllowedFetch(url);
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(Number(options.timeoutMs || process.env.GRANTHAGARA_FETCH_TIMEOUT_MS || 45000)),
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 boi-dataset-scrape",
          accept: options.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "bn,en-US;q=0.9,en;q=0.8",
          "cache-control": "no-cache"
        }
      });
      assertAllowedFetch(response.url || url);
      const text = await response.text();
      if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
      return {
        text,
        status: response.status,
        final_url: response.url || url,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(750 * attempt);
    }
  }
  throw lastError;
}

async function fetchOptionalText(url, options = {}) {
  try {
    return await fetchText(url, options);
  } catch (error) {
    return { error: error.message, text: "", status: null, final_url: url, headers: {} };
  }
}

function safeUrl(value, baseUrl) {
  if (!value) return null;
  try {
    const parsed = new URL(value, baseUrl);
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseSitemapUrls(xml, predicate = () => true) {
  return unique(
    Array.from(String(xml || "").matchAll(/<loc>\s*([^<]+)\s*<\/loc>/giu))
      .map((match) => cleanText(match[1]))
      .filter(Boolean)
      .filter(predicate)
  );
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

function splitTitle(value) {
  const title = cleanText(value);
  if (!title) return { title: null, title_en: null };
  const [left, ...rest] = title.split(/\s*\|\s*/u).map(cleanText).filter(Boolean);
  const right = cleanText(rest.join(" | "));
  return {
    title: left || title,
    title_en: right && right !== left ? right : null
  };
}

function sourceIdFromUrl(url) {
  const parsed = new URL(url);
  return parsed.pathname.match(/\/boi\/(\d+)-/i)?.[1] || parsed.pathname.split("/").filter(Boolean).pop() || null;
}

function archiveIdFromUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!/archive\.org$/i.test(parsed.hostname)) return null;
    if (/\/details\/([^/?#]+)/i.test(parsed.pathname)) return decodeURIComponent(parsed.pathname.match(/\/details\/([^/?#]+)/i)[1]);
    if (/\/download\/([^/?#]+)/i.test(parsed.pathname)) return decodeURIComponent(parsed.pathname.match(/\/download\/([^/?#]+)/i)[1]);
    if (/\/stream\/([^/?#]+)/i.test(parsed.pathname)) return decodeURIComponent(parsed.pathname.match(/\/stream\/([^/?#]+)/i)[1]);
  } catch {
    return null;
  }
  return null;
}

function parseMetaDescription(description) {
  const result = {};
  const parts = String(description || "").split(/\s*\|\s*/u).map(cleanText).filter(Boolean);
  for (const part of parts) {
    const [rawKey, ...rest] = part.split(/\s*:\s*/u);
    const key = cleanText(rawKey)?.toLowerCase();
    const value = cleanText(rest.join(":"));
    if (!key || !value) continue;
    if (key === "pages") result.pages = numberFromText(value);
    if (key === "size") result.size = value;
    if (key === "author") result.raw_author = value;
  }
  return result;
}

function splitAuthorName(value) {
  const text = cleanText(value);
  if (!text) return { display: null, name_en: null, name_bn: null };
  const parts = text.split(/\s+-\s+/u).map(cleanText).filter(Boolean);
  const bangla = parts.find((part) => /[\u0980-\u09FF]/.test(part));
  const english = parts.find((part) => part && !/[\u0980-\u09FF]/.test(part));
  return {
    display: bangla || english || text,
    name_en: english || null,
    name_bn: bangla || null
  };
}

function parseDetail(html, url) {
  const $ = cheerio.load(html);
  $("script,style,noscript,svg").remove();
  const heading = cleanText($("h1").first().text()) || cleanText($("meta[property='og:title']").attr("content"));
  const { title, title_en: headingTitleEn } = splitTitle(heading);
  if (!title) return null;

  const description = cleanText($("meta[name='description']").attr("content") || $("meta[property='og:description']").attr("content"));
  const descriptionMeta = parseMetaDescription(description);
  const authorLink = $("a[href*='/writer/']")
    .map((_, node) => cleanText($(node).text()))
    .get()
    .find(Boolean);
  const rawAuthor = authorLink || descriptionMeta.raw_author || null;
  const authorParts = splitAuthorName(rawAuthor);
  const categoryLinks = $("a[href*='/genres/']")
    .map((_, node) => cleanText($(node).text()))
    .get();
  const image =
    safeUrl($("meta[property='og:image']").attr("content") || $("meta[name='twitter:image']").attr("content"), url) ||
    safeUrl($("img").first().attr("src"), url);

  const archiveItemUrl = $("a[href*='archive.org/details/']")
    .map((_, node) => safeUrl($(node).attr("href"), url))
    .get()
    .find(Boolean);
  const archiveStreamUrl = $("a[href*='archive.org/stream/']")
    .map((_, node) => safeUrl($(node).attr("href"), url))
    .get()
    .find(Boolean);
  const omittedArchiveDownloadCount = $("a[href*='archive.org/download/']").length;
  const archiveItemId = archiveIdFromUrl(archiveItemUrl || archiveStreamUrl);
  const titleEn =
    headingTitleEn ||
    cleanText(description?.match(/অনলাইন\s+(.+?)\s+in Bengali Free PDF/iu)?.[1]) ||
    null;

  return {
    source: "Granthagara",
    source_slug: "granthagara",
    source_id: sourceIdFromUrl(url),
    url,
    retrieved_at: retrievedAt,
    title,
    ...(titleEn ? { title_en: titleEn } : {}),
    contributors: authorParts.display ? [{ name: authorParts.display, role: "author" }] : [],
    ...(authorParts.name_en ? { author_en: authorParts.name_en } : {}),
    ...(authorParts.name_bn ? { author_bn: authorParts.name_bn } : {}),
    pages: descriptionMeta.pages || numberFromText(description?.match(/Pages\s*:\s*([^|]+)/iu)?.[1]),
    size: descriptionMeta.size || cleanText(description?.match(/Size\s*:\s*([^|]+)/iu)?.[1]),
    language: "bangla",
    categories: unique(categoryLinks),
    cover_url: image,
    archive_item_url: archiveItemUrl || null,
    archive_item_id: archiveItemId,
    omitted_archive_download_links: omittedArchiveDownloadCount,
    omitted_archive_stream_url: archiveStreamUrl ? true : false,
    raw_author: rawAuthor,
    raw_description: description
  };
}

function sourceState() {
  const booksPath = path.join(runDir, "books.jsonl");
  const existingRows = readJsonl(booksPath);
  return {
    booksPath,
    rows: existingRows.length,
    seenUrls: new Set(existingRows.map((row) => row.url).filter(Boolean))
  };
}

async function main() {
  ensureDir(runDir);
  const state = sourceState();
  const errors = [];

  const robots = await fetchOptionalText("https://granthagara.com/robots.txt", { accept: "text/plain,*/*" });
  fs.writeFileSync(path.join(runDir, "robots.txt"), robots.text || robots.error || "", "utf8");

  const sitemapIndex = await fetchText("https://granthagara.com/sitemap_index.xml", {
    accept: "application/xml,text/xml,*/*"
  });
  fs.writeFileSync(path.join(runDir, "sitemap_index.xml"), sitemapIndex.text, "utf8");
  const sitemapUrls = parseSitemapUrls(sitemapIndex.text, (url) => /\/boi-sitemap\d+\.xml$/i.test(url));
  const bookUrls = [];
  const sitemapFiles = [];

  await mapLimit(sitemapUrls, Math.min(concurrency, 4), async (sitemapUrl, index) => {
    const response = await fetchText(sitemapUrl, { accept: "application/xml,text/xml,*/*" });
    const fileName = `boi-sitemap-${index + 1}.xml`;
    fs.writeFileSync(path.join(runDir, fileName), response.text, "utf8");
    sitemapFiles.push(fileName);
    for (const url of parseSitemapUrls(response.text, (value) => /granthagara\.com\/boi\//i.test(value))) {
      bookUrls.push(url);
    }
  });

  const urls = unique(bookUrls).sort();
  writeJsonl(
    path.join(runDir, "sitemap-book-urls.jsonl"),
    urls.map((url) => ({ url }))
  );

  const queue = urls.filter((url) => !state.seenUrls.has(url)).slice(0, limit || undefined);
  let fetchedThisRun = 0;
  await mapLimit(queue, concurrency, async (url, index) => {
    try {
      const response = await fetchText(url);
      const row = parseDetail(response.text, response.final_url);
      fetchedThisRun += 1;
      if (row && !state.seenUrls.has(row.url)) {
        appendJsonl(state.booksPath, row);
        state.seenUrls.add(row.url);
        state.rows += 1;
      }
      if ((index + 1) % 100 === 0) {
        console.log(`[granthagara] ${index + 1}/${queue.length} fetched (${state.rows} total)`);
      }
    } catch (error) {
      errors.push({ url, error: error.message });
      if (errors.length % 25 === 0) writeJsonl(path.join(runDir, "errors.jsonl"), errors);
    }
  });

  writeJsonl(path.join(runDir, "errors.jsonl"), errors);
  writeJson(path.join(runDir, "manifest.json"), {
    source: "Granthagara",
    source_slug: sourceSlug,
    run_id: runId,
    retrieved_at: retrievedAt,
    generated_at: new Date().toISOString(),
    notes:
      "Granthagara metadata-only scrape from public book sitemaps and book detail pages. The scraper records visible catalog metadata and Archive.org item references only; it refuses file, feed, admin, account, and unexpected-host endpoints.",
    sitemap_urls: sitemapUrls.length,
    sitemap_book_urls: urls.length,
    sitemap_files: sitemapFiles.sort((left, right) => left.localeCompare(right, undefined, { numeric: true })),
    fetched_this_run: fetchedThisRun,
    errors: errors.length,
    records: state.rows,
    files: {
      books: `${sourceSlug}/${runId}/books.jsonl`,
      sitemap_book_urls: `${sourceSlug}/${runId}/sitemap-book-urls.jsonl`
    }
  });

  console.log(
    JSON.stringify(
      {
        run_id: runId,
        sitemap_book_urls: urls.length,
        records: state.rows,
        fetched_this_run: fetchedThisRun,
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
