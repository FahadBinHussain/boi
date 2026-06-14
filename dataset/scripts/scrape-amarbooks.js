const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { archiveDir } = require("./paths");

const sourceName = "AmarBooks";
const baseUrl = "https://www.amarbooks.org";
const retrievedAt = process.env.DATASET_RETRIEVED_AT || new Date().toISOString().slice(0, 10);
const runId = process.env.AMARBOOKS_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(archiveDir, "amarbooks", runId);
const limit = Number(process.env.AMARBOOKS_LIMIT || 0);
const delayMs = Number(process.env.AMARBOOKS_DELAY_MS || 150);

const endpoints = {
  robots: `${baseUrl}/robots.txt`,
  sitemap: `${baseUrl}/sitemap.php`
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

function hasBangla(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function unique(values) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value, "utf8");
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(filePath, rows) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");
}

function absolutize(url, fromUrl = baseUrl) {
  if (!url) return null;
  try {
    return new URL(url, fromUrl).toString();
  } catch {
    return null;
  }
}

function idFromDetailUrl(url) {
  try {
    return new URL(url).searchParams.get("id");
  } catch {
    return null;
  }
}

function assertAllowedFetch(url) {
  const parsed = new URL(url, baseUrl);
  const host = parsed.hostname.toLowerCase();
  if (host !== "www.amarbooks.org" && host !== "amarbooks.org") {
    throw new Error(`Refusing to fetch non-AmarBooks URL: ${url}`);
  }
  const pathname = parsed.pathname.toLowerCase();
  if (
    pathname.startsWith("/pdfurl/") ||
    pathname.includes("captcha.php") ||
    /\.(?:pdf|epub|mobi|zip|rar|7z)$/i.test(pathname)
  ) {
    throw new Error(`Refusing to fetch AmarBooks file/download endpoint: ${url}`);
  }
}

async function fetchText(url, options = {}) {
  assertAllowedFetch(url);
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          accept: options.accept || "text/html,text/xml,text/plain,*/*",
          "accept-language": "en-US,en;q=0.9,bn;q=0.8",
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

function parseSitemap(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("url")
    .map((_, node) => ({
      loc: cleanText($(node).find("loc").first().text()),
      priority: cleanText($(node).find("priority").first().text())
    }))
    .get()
    .filter((entry) => entry.loc);
}

function parseJsonLd($) {
  const scripts = $('script[type="application/ld+json"]')
    .map((_, node) => cleanText($(node).text()))
    .get()
    .filter(Boolean);

  for (const script of scripts) {
    try {
      return JSON.parse(script);
    } catch {
      // Some pages contain non-critical schema issues; fall back to visible HTML.
    }
  }
  return null;
}

function parseDate(value) {
  const text = cleanText(value);
  if (!text) return null;
  const dotted = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotted) {
    const [, day, month, year] = dotted;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : null;
}

function parseNumber(value) {
  const match = cleanText(value)?.match(/\d[\d,]*/);
  return match ? Number(match[0].replace(/,/g, "")) : null;
}

function stripDecor(value) {
  return cleanText(value)?.replace(/^[^\p{Letter}\p{Number}:]+/u, "").trim() || null;
}

function parseTitleParts(pageTitle) {
  const title = cleanText(pageTitle);
  if (!title) return {};
  const pieces = title
    .replace(/\s*✔️?\s*Free Download\s*$/iu, "")
    .split("❤️")
    .map((piece) => cleanText(piece?.replace(/\s*Free Download\s*$/iu, "")))
    .filter(Boolean);
  const fileSizePiece = pieces.find((piece) => /^\(?\s*\d+(?:\.\d+)?\s*(?:KB|MB|GB)\s*\)?$/i.test(piece));
  const firstBangla = pieces.find((piece, index) => index > 0 && hasBangla(piece));
  const category = pieces
    .slice()
    .reverse()
    .find((piece) => piece !== fileSizePiece && piece !== firstBangla && !/Free Download/i.test(piece));
  return {
    title_en: pieces[0] || null,
    title_bn: firstBangla || null,
    file_size: fileSizePiece ? fileSizePiece.replace(/[()]/g, "").trim() : null,
    category_name: category && category !== pieces[0] ? category : null
  };
}

function parseAtAGlance($) {
  const result = {};
  const lines = $("h2,h3")
    .map((_, node) => stripDecor($(node).text()))
    .get()
    .filter(Boolean);

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = cleanText(rawKey)?.toLowerCase();
    const value = cleanText(rest.join(":"));
    if (!key) continue;
    if (key === "book") result.book_title = value;
    else if (key === "file size") result.file_size = value;
    else if (key === "total page") result.total_pages = parseNumber(value);
    else if (key === "last update") result.last_update = parseDate(value);
    else if (key === "viewed") result.viewed = parseNumber(value);
    else if (!value && !result.category_name && !/^at a glance$/i.test(line) && !/^you also like/i.test(line)) {
      result.category_name = line;
    }
  }
  return result;
}

function parseDetailPage(html, url) {
  const $ = cheerio.load(html);
  const id = idFromDetailUrl(url);
  const pageTitle = cleanText($("title").first().text());
  if (/^Page Not Found$/i.test(pageTitle || "") || /page-not-found\.png/i.test(html)) {
    throw new Error("AmarBooks detail page returned Page Not Found");
  }
  const jsonLd = parseJsonLd($);
  const titleParts = parseTitleParts(pageTitle);
  const atAGlance = parseAtAGlance($);
  const thumb = $("img")
    .map((_, node) => $(node).attr("src"))
    .get()
    .find((src) => /\/thumbs\//i.test(src || ""));
  const categoryUrl = absolutize(jsonLd?.author?.url || null, url);
  const categoryId = categoryUrl ? new URL(categoryUrl).searchParams.get("cd") : null;
  const pdfMentions = (html.match(/pdfurl\//gi) || []).length;
  const captchaMentions = (html.match(/captcha\.php/gi) || []).length;

  const titleEn = atAGlance.book_title || titleParts.title_en || cleanText(jsonLd?.headline);
  const titleBn = titleParts.title_bn;
  const categoryName = atAGlance.category_name || cleanText(jsonLd?.author?.name) || titleParts.category_name;

  return {
    source: sourceName,
    source_id: id,
    url,
    retrieved_at: retrievedAt,
    title: titleEn,
    title_bn: titleBn,
    raw_page_title: pageTitle,
    category_name: categoryName,
    category_id: categoryId,
    category_url: categoryUrl,
    file_size: atAGlance.file_size || titleParts.file_size || null,
    total_pages: atAGlance.total_pages || null,
    last_update: atAGlance.last_update || parseDate(jsonLd?.dateModified),
    date_modified: parseDate(jsonLd?.dateModified),
    viewed: atAGlance.viewed || null,
    cover_url: absolutize(jsonLd?.image?.url || thumb, url),
    schema_headline: cleanText(jsonLd?.headline),
    schema_description: cleanText(jsonLd?.description),
    schema_keywords: Array.isArray(jsonLd?.keywords) ? unique(jsonLd.keywords) : [],
    wikipedia_url: $("a")
      .map((_, node) => absolutize($(node).attr("href"), url))
      .get()
      .find((href) => /^https?:\/\/bn\.wikipedia\.org\//i.test(href || null)) || null,
    has_read_online_anchor: $('a[href="#pdf"]').length > 0,
    omitted_file_link_mentions: {
      pdfurl: pdfMentions,
      captcha: captchaMentions
    },
    warnings: [
      !titleEn && !titleBn ? "missing_title" : null,
      !categoryName ? "missing_category_or_author_label" : null,
      pdfMentions ? "page_contains_pdfurl_links_not_fetched" : null,
      captchaMentions ? "page_contains_captcha_not_fetched" : null
    ].filter(Boolean)
  };
}

function categoryRowsFromBooks(books, sitemapCategories) {
  const rowsByKey = new Map();
  for (const entry of sitemapCategories) {
    const parsed = new URL(entry.loc);
    const key = parsed.searchParams.get("cd") || parsed.searchParams.get("key") || entry.loc;
    rowsByKey.set(key, {
      source: sourceName,
      category_id: parsed.searchParams.get("cd"),
      category_key: parsed.searchParams.get("key"),
      url: entry.loc,
      retrieved_at: retrievedAt,
      name: null,
      book_count_seen: 0,
      source_ids: []
    });
  }

  for (const book of books) {
    const key = book.category_id || book.category_url || book.category_name;
    if (!key) continue;
    const row =
      rowsByKey.get(key) ||
      {
        source: sourceName,
        category_id: book.category_id,
        category_key: null,
        url: book.category_url,
        retrieved_at: retrievedAt,
        name: null,
        book_count_seen: 0,
        source_ids: []
      };
    row.name ||= book.category_name;
    row.book_count_seen += 1;
    row.source_ids.push(book.source_id);
    rowsByKey.set(key, row);
  }

  return Array.from(rowsByKey.values()).map((row) => ({
    ...row,
    source_ids: unique(row.source_ids)
  }));
}

async function main() {
  ensureDir(runDir);

  const robots = await fetchText(endpoints.robots, { accept: "text/plain,*/*" });
  writeText(path.join(runDir, "robots.txt"), robots.text);

  const sitemap = await fetchText(endpoints.sitemap, { accept: "text/xml,*/*" });
  writeText(path.join(runDir, "sitemap.xml"), sitemap.text);

  const sitemapEntries = parseSitemap(sitemap.text);
  const categoryUrls = sitemapEntries.filter((entry) => /\/cat\.php\?/i.test(entry.loc));
  const detailUrls = sitemapEntries
    .filter((entry) => /\/download\.php\?id=\d+/i.test(entry.loc))
    .map((entry) => entry.loc)
    .sort((a, b) => Number(idFromDetailUrl(a)) - Number(idFromDetailUrl(b)));
  const selectedDetailUrls = limit ? detailUrls.slice(0, limit) : detailUrls;

  writeJson(path.join(runDir, "sitemap-summary.json"), {
    source: sourceName,
    retrieved_at: retrievedAt,
    robots_url: endpoints.robots,
    sitemap_url: endpoints.sitemap,
    counts: {
      sitemap_urls: sitemapEntries.length,
      category_urls: categoryUrls.length,
      detail_urls: detailUrls.length,
      selected_detail_urls: selectedDetailUrls.length
    },
    safety: {
      fetched_detail_pages_named_download_php: true,
      fetched_pdfurl_or_book_files: false,
      fetched_captcha: false
    }
  });

  const books = [];
  const errors = [];
  for (const [index, url] of selectedDetailUrls.entries()) {
    const id = idFromDetailUrl(url);
    try {
      const response = await fetchText(url, { accept: "text/html,*/*" });
      const row = parseDetailPage(response.text, url);
      books.push(row);
    } catch (error) {
      errors.push({ source_id: id, url, error: error.message });
    }

    if ((index + 1) % 25 === 0 || index + 1 === selectedDetailUrls.length) {
      console.log(`[${index + 1}/${selectedDetailUrls.length}] parsed=${books.length} errors=${errors.length}`);
    }
    if (index + 1 < selectedDetailUrls.length) await sleep(delayMs);
  }

  const categories = categoryRowsFromBooks(books, categoryUrls);
  writeJsonl(path.join(runDir, "books.jsonl"), books);
  writeJsonl(path.join(runDir, "categories.jsonl"), categories);
  writeJsonl(path.join(runDir, "errors.jsonl"), errors);

  const warnings = {};
  for (const book of books) {
    for (const warning of book.warnings || []) warnings[warning] = (warnings[warning] || 0) + 1;
  }

  const manifest = {
    source: sourceName,
    base_url: baseUrl,
    run_id: runId,
    retrieved_at: retrievedAt,
    checked_at: new Date().toISOString(),
    config: {
      limit: limit || null,
      delay_ms: delayMs
    },
    counts: {
      sitemap_urls: sitemapEntries.length,
      category_urls: categoryUrls.length,
      detail_urls: detailUrls.length,
      checked: selectedDetailUrls.length,
      parsed_books: books.length,
      categories: categories.length,
      errors: errors.length,
      skipped_due_to_limit: detailUrls.length - selectedDetailUrls.length
    },
    warnings,
    safety: {
      no_book_files_downloaded: true,
      pdfurl_links_not_fetched: true,
      captcha_not_fetched: true,
      raw_detail_html_not_saved: true
    },
    output_files: {
      books: "books.jsonl",
      categories: "categories.jsonl",
      errors: "errors.jsonl",
      sitemap: "sitemap.xml",
      robots: "robots.txt"
    }
  };
  writeJson(path.join(runDir, "manifest.json"), manifest);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
