const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { archiveDir } = require("./paths");

const sourceSlug = "medium-retailer-sources";
const retrievedAt = process.env.DATASET_RETRIEVED_AT || new Date().toISOString().slice(0, 10);
const runId = process.env.RETAILER_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(archiveDir, sourceSlug, runId);
const delayMs = Number(process.env.RETAILER_DELAY_MS || 250);
const concurrency = Math.max(1, Number(process.env.RETAILER_CONCURRENCY || 2));
const selectedSources = new Set(
  (process.env.RETAILER_SOURCES || "boibazar,eboighar,wafilife,baatighar")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

const limits = {
  boibazar: Number(process.env.BOIBAZAR_LIMIT || 0),
  eboighar: Number(process.env.EBOIGHAR_LIMIT || 0),
  wafilife: Number(process.env.WAFILIFE_LIMIT || 0),
  baatighar: Number(process.env.BAATIGHAR_LIMIT || 0)
};

const pageLimits = {
  boibazar: Number(process.env.BOIBAZAR_PAGE_LIMIT || 0),
  baatighar: Number(process.env.BAATIGHAR_PAGE_LIMIT || 0)
};
const boibazarZeroAddedBreak = Number(process.env.BOIBAZAR_ZERO_ADDED_BREAK || 15);
const boibazarPageFetchConcurrency = Math.max(1, Number(process.env.BOIBAZAR_PAGE_FETCH_CONCURRENCY || 1));
const baatigharPageFetchConcurrency = Math.max(1, Number(process.env.BAATIGHAR_PAGE_FETCH_CONCURRENCY || 1));

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

function splitPeople(value) {
  return unique(
    String(value || "")
      .replace(/\s+(?:and|এবং|ও)\s+/giu, ",")
      .split(/\s*(?:,|;|،|\||\/)\s*/u)
  );
}

function firstYear(value) {
  const matches = Array.from(String(value || "").matchAll(/\b(1[5-9]\d{2}|20\d{2})\b/g)).map((match) => Number(match[1]));
  return matches.length ? matches[matches.length - 1] : null;
}

function numberFromText(value) {
  const normalized = String(value || "").replace(/[০-৯]/g, (digit) => "০১২৩৪৫৬৭৮৯".indexOf(digit));
  const match = normalized.match(/\b\d+\b/);
  return match ? Number(match[0]) : null;
}

function hasBangla(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function isMenuNoise(value) {
  const text = cleanText(value);
  return (
    !text ||
    /(?:আজকের অফার|প্রি-অর্ডার|উইশলিস্ট|শপিং ব্যাগ|কর্পোরেট|Wafilife অ্যাপ|Google Play|Open App|Sign In|লেখকপ্রকাশক)/iu.test(text)
  );
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

function allowedFetchHost(host) {
  return new Set([
    "www.boibazar.com",
    "boibazar.com",
    "m.boibazar.com",
    "eboighar.com",
    "www.eboighar.com",
    "www.wafilife.com",
    "wafilife.com",
    "baatighar.com",
    "www.baatighar.com"
  ]).has(host);
}

function assertAllowedFetch(url) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  if (!allowedFetchHost(host)) {
    throw new Error(`Refusing to fetch unexpected host: ${url}`);
  }
  if (/\.(?:pdf|epub|mobi|doc|docx|zip|rar|7z)(?:$|\?)/i.test(parsed.pathname)) {
    throw new Error(`Refusing to fetch file endpoint: ${url}`);
  }
  if (/\/(?:cart|checkout|my-account|account|login|signup|wishlist)(?:\/|$)/i.test(parsed.pathname)) {
    throw new Error(`Refusing to fetch account/cart endpoint: ${url}`);
  }
}

async function fetchText(url, options = {}) {
  assertAllowedFetch(url);
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(Number(options.timeoutMs || process.env.RETAILER_FETCH_TIMEOUT_MS || 45000)),
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 boi-dataset-scrape",
          accept: options.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
          "accept-language": "bn,en-US;q=0.9,en;q=0.8",
          "cache-control": "no-cache",
          ...(options.headers || {})
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

function htmlText(html) {
  const withBreaks = String(html || "")
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, "\n")
    .replace(
      /(Author|Publisher|Edition|ISBN|Pages|Language|Country|Category|Subject|Update Date|লেখক|প্রকাশনী|বিষয়|পৃষ্ঠা|সংস্করণ|Writer|First Published|Format)\s*[:：]?/giu,
      "\n$&"
    );
  const $ = cheerio.load(withBreaks);
  $("script,style,noscript,svg").remove();
  return cleanText($.root().text());
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function labelValue(text, labels, stopLabels) {
  const labelPattern = labels.map(escapeRegExp).join("|");
  const stopPattern = stopLabels.map(escapeRegExp).join("|");
  const pattern = new RegExp(`(?:^|\\s)(?:${labelPattern})\\s*[:：]?\\s*([\\s\\S]*?)(?=\\s+(?:${stopPattern})\\s*[:：]?\\s|$)`, "iu");
  return cleanText(String(text || "").match(pattern)?.[1]);
}

function sliceFromMarker(text, markers) {
  const source = String(text || "");
  const positions = markers.map((marker) => source.indexOf(marker)).filter((index) => index >= 0);
  if (!positions.length) return source;
  return source.slice(Math.min(...positions));
}

function sliceBeforeMarker(text, markers) {
  const source = String(text || "");
  const positions = markers.map((marker) => source.indexOf(marker)).filter((index) => index >= 0);
  if (!positions.length) return source;
  return source.slice(0, Math.min(...positions));
}

function parseJsonLd($) {
  const values = [];
  $("script[type*='ld+json']").each((_, node) => {
    const raw = cleanText($(node).html());
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      collectJsonLd(parsed, values);
    } catch {
      // Some pages include script text that is not clean JSON-LD. Visible labels still cover those rows.
    }
  });
  return values;
}

function collectJsonLd(value, out) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLd(item, out);
    return;
  }
  if (typeof value !== "object") return;
  out.push(value);
  if (value["@graph"]) collectJsonLd(value["@graph"], out);
  for (const key of ["mainEntity", "workExample", "itemListElement"]) {
    if (value[key]) collectJsonLd(value[key], out);
  }
}

function jsonLdType(value) {
  const type = value?.["@type"];
  if (Array.isArray(type)) return type.join(" ");
  return String(type || "");
}

function jsonName(value) {
  if (!value) return null;
  if (typeof value === "string") return cleanText(value);
  if (Array.isArray(value)) return unique(value.map(jsonName)).join(", ") || null;
  return cleanText(value.name);
}

function contributorsFromNames(names, role = "author") {
  return splitPeople(names).map((name) => ({ name, role }));
}

function sourceState(sourceDir) {
  const booksPath = path.join(sourceDir, "books.jsonl");
  const existingRows = readJsonl(booksPath);
  return {
    booksPath,
    existingRows,
    rows: existingRows.length,
    seenUrls: new Set(existingRows.map((row) => row.url).filter(Boolean)),
    seenIds: new Set(existingRows.map((row) => row.source_id).filter(Boolean))
  };
}

function completedCatalogPageUrls(pageRows) {
  const byUrl = new Map();
  for (const row of pageRows) {
    if (!row.url || Number(row.product_cards) <= 0) continue;
    const stats = byUrl.get(row.url) || { productCards: 0, added: 0 };
    stats.productCards = Math.max(stats.productCards, Number(row.product_cards) || 0);
    stats.added += Number(row.added) || 0;
    byUrl.set(row.url, stats);
  }
  return new Set(
    Array.from(byUrl.entries())
      .filter(([, stats]) => stats.productCards > 0 && stats.added >= stats.productCards)
      .map(([url]) => url)
  );
}

function writeSourceManifest(sourceDir, manifest) {
  writeJson(path.join(sourceDir, "manifest.json"), manifest);
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

function sourceIdFromLastPath(url) {
  return new URL(url).pathname.split("/").filter(Boolean).pop() || null;
}

function productIdFromPath(url) {
  return new URL(url).pathname.match(/\/(?:pd|dp)\/(\d+)\/?$/i)?.[1] || null;
}

function safeUrl(value, baseUrl) {
  if (!value) return null;
  try {
    const parsed = new URL(value, baseUrl);
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    if (!allowedFetchHost(parsed.hostname.toLowerCase()) && /(?:pdf|epub|mobi|zip|rar|7z|drive|mediafire|mega|dropbox)/i.test(parsed.hostname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseBoibazarCards(html, baseUrl, category) {
  const $ = cheerio.load(html);
  const rows = [];
  $(".thumbnail-custom").each((_, node) => {
    const card = $(node);
    const link = card.find("a[href*='/book/']").first();
    const url = safeUrl(link.attr("href"), baseUrl);
    if (!url || !/boibazar\.com\/book\//i.test(url)) return;
    const sourceId = sourceIdFromLastPath(url);
    const title =
      cleanText(card.find(".line_nowrap_prod p").first().text()) ||
      cleanText(card.find("img[alt]").first().attr("alt")) ||
      cleanText(link.text());
    const author = cleanText(card.find(".line_nowrap_aut p").first().text());
    if (!title) return;
    const image = safeUrl(card.find("img.bookimage").first().attr("lsrc") || card.find("img.bookimage").first().attr("src"), baseUrl);

    rows.push({
      source: "Boibazar",
      source_slug: "boibazar",
      source_id: sourceId,
      url,
      retrieved_at: retrievedAt,
      title,
      contributors: contributorsFromNames(author),
      categories: category?.name ? [category.name] : [],
      category_slug: category?.slug || null,
      cover_url: image && !/book-no-photo/i.test(image) ? image : null,
      raw_listing_text: cleanText(card.text())?.slice(0, 500) || null
    });
  });
  return rows;
}

async function scrapeBoibazar() {
  const source = "boibazar";
  const baseUrl = "https://www.boibazar.com";
  const sourceDir = path.join(runDir, source);
  ensureDir(sourceDir);
  const state = sourceState(sourceDir);
  const catalogPagesPath = path.join(sourceDir, "catalog-pages.jsonl");
  const pageRows = readJsonl(catalogPagesPath);
  const completedPageUrls = completedCatalogPageUrls(pageRows);
  let pagesChecked = 0;
  let pagesWithRows = 0;
  let duplicateRows = 0;
  let stopReason = "completed";

  const robots = await fetchOptionalText(`${baseUrl}/robots.txt`, { accept: "text/plain,*/*" });
  fs.writeFileSync(path.join(sourceDir, "robots.txt"), robots.text || robots.error || "", "utf8");
  const sitemap = await fetchOptionalText(`${baseUrl}/sitemap.xml`, { accept: "application/xml,text/xml,*/*" });
  fs.writeFileSync(path.join(sourceDir, "sitemap.xml"), sitemap.text || sitemap.error || "", "utf8");

  const categorySources = await Promise.all([fetchText(`${baseUrl}/`), fetchText(`${baseUrl}/categories`)]);
  const categoryMap = new Map();
  for (const { text, final_url } of categorySources) {
    const $ = cheerio.load(text);
    $("a[href*='/category-books/']").each((_, node) => {
      const url = safeUrl($(node).attr("href"), final_url);
      if (!url) return;
      const slug = sourceIdFromLastPath(url);
      if (!slug || categoryMap.has(slug)) return;
      categoryMap.set(slug, {
        slug,
        name: cleanText($(node).text()) || slug,
        url
      });
    });
  }

  const categories = Array.from(categoryMap.values()).sort((a, b) => a.slug.localeCompare(b.slug));
  writeJson(path.join(sourceDir, "categories.json"), {
    retrieved_at: retrievedAt,
    source_pages: [`${baseUrl}/`, `${baseUrl}/categories`],
    count: categories.length,
    categories
  });

  for (const category of categories) {
    const seenPageSignatures = new Set();
    let consecutiveZeroAddedPages = 0;
    for (let page = 1; ; page += boibazarPageFetchConcurrency) {
      if (limits.boibazar && state.rows >= limits.boibazar) {
        stopReason = "limit";
        break;
      }
      if (pageLimits.boibazar && pagesChecked >= pageLimits.boibazar) {
        stopReason = "page_limit";
        break;
      }

      const batch = Array.from({ length: boibazarPageFetchConcurrency }, (_, offset) => {
        const batchPage = page + offset;
        const pageUrl =
          batchPage === 1
            ? category.url
            : `${baseUrl}/page/number/category-books/${encodeURIComponent(category.slug)}/${batchPage}`;
        return { page: batchPage, url: pageUrl };
      }).filter((entry) => !completedPageUrls.has(entry.url));

      if (!batch.length) continue;

      const results = await Promise.all(
        batch.map(async (entry) => {
          try {
            const response = await fetchText(entry.url);
            return { ...entry, response };
          } catch (error) {
            return { ...entry, error };
          }
        })
      );

      let shouldBreakCategory = false;
      for (const result of results.sort((left, right) => left.page - right.page)) {
        if (result.error) {
          if (result.page === 1) {
            pageRows.push({ category_slug: category.slug, page: result.page, url: result.url, error: result.error.message });
          }
          shouldBreakCategory = true;
          break;
        }

        pagesChecked += 1;
        const rows = parseBoibazarCards(result.response.text, result.response.final_url, category);
        const signature = rows.map((row) => row.url).join("|");
        if (!rows.length || seenPageSignatures.has(signature)) {
          shouldBreakCategory = true;
          break;
        }
        seenPageSignatures.add(signature);
        pagesWithRows += 1;

        let added = 0;
        for (const row of rows) {
          if (state.seenUrls.has(row.url)) {
            duplicateRows += 1;
            continue;
          }
          state.seenUrls.add(row.url);
          if (row.source_id) state.seenIds.add(row.source_id);
          appendJsonl(state.booksPath, row);
          state.rows += 1;
          added += 1;
          if (limits.boibazar && state.rows >= limits.boibazar) break;
        }

        pageRows.push({
          category_slug: category.slug,
          category_name: category.name,
          page: result.page,
          url: result.url,
          final_url: result.response.final_url,
          product_cards: rows.length,
          added
        });
        completedPageUrls.add(result.url);
        if (pageRows.length % 50 === 0) writeJsonl(catalogPagesPath, pageRows);
        console.log(`[boibazar] ${category.slug} page ${result.page}: ${added}/${rows.length} added (${state.rows} total)`);
        consecutiveZeroAddedPages = added === 0 ? consecutiveZeroAddedPages + 1 : 0;
        if (boibazarZeroAddedBreak && consecutiveZeroAddedPages >= boibazarZeroAddedBreak) {
          pageRows.push({
            category_slug: category.slug,
            category_name: category.name,
            page: result.page,
            url: result.url,
            stop_reason: "consecutive_zero_added_pages",
            zero_added_pages: consecutiveZeroAddedPages
          });
          shouldBreakCategory = true;
          break;
        }
        if (limits.boibazar && state.rows >= limits.boibazar) {
          shouldBreakCategory = true;
          break;
        }
      }

      if (delayMs) await sleep(delayMs);
      if (shouldBreakCategory) break;
    }
    if (stopReason !== "completed") break;
  }

  writeJsonl(catalogPagesPath, pageRows);
  writeSourceManifest(sourceDir, {
    source: "Boibazar",
    source_slug: source,
    run_id: runId,
    retrieved_at: retrievedAt,
    generated_at: new Date().toISOString(),
    notes: "Boibazar metadata-only scrape from public category listings and AJAX pagination; no cart, account, or file endpoints fetched.",
    categories: categories.length,
    pages_checked: pagesChecked,
    pages_with_rows: pagesWithRows,
    duplicate_rows: duplicateRows,
    records: state.rows,
    stop_reason: stopReason,
    files: {
      books: `${sourceSlug}/${runId}/${source}/books.jsonl`,
      catalog_pages: `${sourceSlug}/${runId}/${source}/catalog-pages.jsonl`,
      categories: `${sourceSlug}/${runId}/${source}/categories.json`
    }
  });
  return state.rows;
}

function parseSitemapUrls(xml, predicate = () => true) {
  return unique(
    Array.from(String(xml || "").matchAll(/<loc>\s*([^<]+)\s*<\/loc>/giu))
      .map((match) => cleanText(match[1]))
      .filter(Boolean)
      .filter(predicate)
  );
}

function eboigharDetailRow(html, url) {
  const $ = cheerio.load(html);
  const jsonLd = parseJsonLd($);
  const book = jsonLd.find((item) => /book/i.test(jsonLdType(item))) || {};
  const workExample = Array.isArray(book.workExample) ? book.workExample[0] : book.workExample || {};
  const text = htmlText(html);
  const specText = sliceBeforeMarker(sliceFromMarker(text, ["Specification"]), ["Add to Cart Author's Other Books", "Author's Other Books", "Similar Books", "Reviews"]);
  const stopLabels = ["Title", "Author", "Publisher", "Edition", "ISBN", "Pages", "Country", "Language", "Category", "Subject", "Update Date"];
  const title = cleanText($("h1").first().text()) || cleanText(book.name) || cleanText($("title").text().split("|")[0]);
  const titleParts = cleanText($("title").text())
    ?.split(/\s+-\s+/u)
    .map((part) => cleanText(part?.split("|")[0]))
    .filter(Boolean) || [];
  const rawAuthor =
    labelValue(specText, ["Author"], stopLabels) ||
    jsonName(book.author) ||
    jsonName(workExample.author);
  const publisher = labelValue(specText, ["Publisher"], stopLabels) || jsonName(book.publisher) || jsonName(workExample.publisher);
  const edition = labelValue(specText, ["Edition"], stopLabels) || cleanText(workExample.bookEdition || book.bookEdition);
  const isbn = labelValue(specText, ["ISBN"], stopLabels) || cleanText(workExample.isbn || book.isbn);
  const pages = numberFromText(labelValue(specText, ["Pages"], stopLabels) || workExample.numberOfPages || book.numberOfPages);
  const language = labelValue(specText, ["Language"], stopLabels) || cleanText(workExample.inLanguage || book.inLanguage);
  const category = labelValue(specText, ["Category"], stopLabels);
  const subject = labelValue(specText, ["Subject"], stopLabels);
  const updateDate = labelValue(specText, ["Update Date"], stopLabels);
  const sourceId = new URL(url).pathname.match(/\/booksdetails\/(\d+)/i)?.[1] || sourceIdFromLastPath(url);

  if (!title) return null;
  return {
    source: "eBoighar",
    source_slug: "eboighar",
    source_id: sourceId,
    url,
    retrieved_at: retrievedAt,
    title,
    title_en: titleParts.find((part) => part !== title && /[A-Za-z]/.test(part)) || null,
    contributors: contributorsFromNames(rawAuthor),
    publishers: publisher ? [publisher] : [],
    publication_year: firstYear(edition),
    edition,
    isbn,
    pages,
    language,
    categories: unique([category, subject]),
    update_date: updateDate,
    cover_url: safeUrl(jsonName(book.image) || $("meta[property='og:image']").attr("content"), url),
    raw_author: rawAuthor
  };
}

async function scrapeEboighar() {
  const source = "eboighar";
  const baseUrl = "https://eboighar.com";
  const sourceDir = path.join(runDir, source);
  ensureDir(sourceDir);
  const state = sourceState(sourceDir);
  const errors = [];

  const robots = await fetchOptionalText(`${baseUrl}/robots.txt`, { accept: "text/plain,*/*" });
  fs.writeFileSync(path.join(sourceDir, "robots.txt"), robots.text || robots.error || "", "utf8");
  const sitemap = await fetchText(`${baseUrl}/sitemap.xml`, { accept: "application/xml,text/xml,*/*" });
  fs.writeFileSync(path.join(sourceDir, "sitemap.xml"), sitemap.text, "utf8");

  const urls = parseSitemapUrls(sitemap.text, (url) => /eboighar\.com\/booksdetails\/\d+/i.test(url));
  writeJsonl(
    path.join(sourceDir, "sitemap-book-urls.jsonl"),
    urls.map((url) => ({ url }))
  );

  const queue = urls.filter((url) => !state.seenUrls.has(url)).slice(0, limits.eboighar || undefined);
  await mapLimit(queue, concurrency, async (url, index) => {
    try {
      const response = await fetchText(url);
      const row = eboigharDetailRow(response.text, response.final_url);
      if (row && !state.seenUrls.has(row.url)) {
        appendJsonl(state.booksPath, row);
        state.seenUrls.add(row.url);
        state.rows += 1;
      }
      if ((index + 1) % 100 === 0 || index + 1 === queue.length) {
        console.log(`[eboighar] ${index + 1}/${queue.length} fetched (${state.rows} total)`);
      }
    } catch (error) {
      errors.push({ url, error: error.message });
      if (errors.length % 25 === 0) writeJsonl(path.join(sourceDir, "errors.jsonl"), errors);
    }
  });

  writeJsonl(path.join(sourceDir, "errors.jsonl"), errors);
  writeSourceManifest(sourceDir, {
    source: "eBoighar",
    source_slug: source,
    run_id: runId,
    retrieved_at: retrievedAt,
    generated_at: new Date().toISOString(),
    notes: "eBoighar metadata-only scrape from public sitemap book detail pages; no file/download endpoints fetched.",
    sitemap_book_urls: urls.length,
    fetched_this_run: queue.length,
    errors: errors.length,
    records: state.rows,
    files: {
      books: `${sourceSlug}/${runId}/${source}/books.jsonl`,
      sitemap_book_urls: `${sourceSlug}/${runId}/${source}/sitemap-book-urls.jsonl`,
      errors: `${sourceSlug}/${runId}/${source}/errors.jsonl`
    }
  });
  return state.rows;
}

function wafilifeDetailRow(html, url) {
  const $ = cheerio.load(html);
  const jsonLd = parseJsonLd($);
  const product = jsonLd.find((item) => /(?:product|book)/i.test(jsonLdType(item))) || {};
  const text = htmlText(html);
  const stopLabels = ["লেখক", "প্রকাশনী", "বিষয়", "পৃষ্ঠা", "সংস্করণ", "Author", "Publisher", "Edition", "ISBN"];
  const title = cleanText($("h1").first().text()) || cleanText(product.name) || cleanText($("meta[property='og:title']").attr("content"))?.split(" - ")[0];
  const scopedText = sliceFromMarker(text, title ? [title] : ["হোম"]);
  const authors = unique([
    jsonName(product.author),
    labelValue(scopedText, ["লেখক", "Author"], stopLabels)
  ]).filter((value) => !isMenuNoise(value));
  const publisher =
    jsonName(product.publisher) ||
    jsonName(product.brand) ||
    labelValue(scopedText, ["প্রকাশনী", "Publisher"], stopLabels);
  const edition = cleanText(product.edition) || labelValue(scopedText, ["সংস্করণ", "Edition"], stopLabels);
  const pages = numberFromText(product.numberOfPages || labelValue(scopedText, ["পৃষ্ঠা", "Pages"], stopLabels));
  const isbn = cleanText(product.isbn);
  const rawCategory = cleanText(product.category) || labelValue(scopedText, ["বিষয়"], stopLabels);
  const category = isMenuNoise(rawCategory) ? null : rawCategory;
  const sourceId = productIdFromPath(url) || cleanText(product.sku || product.mpn);

  if (!title) return null;
  return {
    source: "Wafilife",
    source_slug: "wafilife",
    source_id: sourceId,
    url,
    retrieved_at: retrievedAt,
    title,
    contributors: authors.flatMap((author) => contributorsFromNames(author)),
    publishers: publisher ? [publisher] : [],
    publication_year: firstYear(edition),
    edition,
    isbn,
    pages,
    categories: category ? [category] : [],
    cover_url: safeUrl(jsonName(product.image) || $("meta[property='og:image']").attr("content"), url),
    raw_author: authors.join(", ") || null
  };
}

async function scrapeWafilife() {
  const source = "wafilife";
  const baseUrl = "https://www.wafilife.com";
  const sourceDir = path.join(runDir, source);
  ensureDir(sourceDir);
  const state = sourceState(sourceDir);
  const errors = [];

  const robots = await fetchOptionalText(`${baseUrl}/robots.txt`, { accept: "text/plain,*/*" });
  fs.writeFileSync(path.join(sourceDir, "robots.txt"), robots.text || robots.error || "", "utf8");
  const sitemapIndex = await fetchText(`${baseUrl}/sitemap.xml`, { accept: "application/xml,text/xml,*/*" });
  fs.writeFileSync(path.join(sourceDir, "sitemap.xml"), sitemapIndex.text, "utf8");
  const productMaps = parseSitemapUrls(sitemapIndex.text, (url) => /\/sitemap-products\//i.test(url));
  const productUrls = [];

  await mapLimit(productMaps, Math.min(concurrency, 4), async (url, index) => {
    const response = await fetchText(url, { accept: "application/xml,text/xml,*/*" });
    fs.writeFileSync(path.join(sourceDir, `sitemap-products-${index + 1}.xml`), response.text, "utf8");
    productUrls.push(...parseSitemapUrls(response.text, (itemUrl) => /\/(?:pd|dp)\/\d+\/?$/i.test(itemUrl)));
  });

  const urls = unique(productUrls);
  writeJsonl(
    path.join(sourceDir, "sitemap-product-urls.jsonl"),
    urls.map((url) => ({ url }))
  );
  const queue = urls.filter((url) => !state.seenUrls.has(url)).slice(0, limits.wafilife || undefined);

  await mapLimit(queue, concurrency, async (url, index) => {
    try {
      const response = await fetchText(url);
      const row = wafilifeDetailRow(response.text, response.final_url);
      if (row && !state.seenUrls.has(row.url)) {
        appendJsonl(state.booksPath, row);
        state.seenUrls.add(row.url);
        state.rows += 1;
      }
      if ((index + 1) % 100 === 0 || index + 1 === queue.length) {
        console.log(`[wafilife] ${index + 1}/${queue.length} fetched (${state.rows} total)`);
      }
    } catch (error) {
      errors.push({ url, error: error.message });
      if (errors.length % 25 === 0) writeJsonl(path.join(sourceDir, "errors.jsonl"), errors);
    }
  });

  writeJsonl(path.join(sourceDir, "errors.jsonl"), errors);
  writeSourceManifest(sourceDir, {
    source: "Wafilife",
    source_slug: source,
    run_id: runId,
    retrieved_at: retrievedAt,
    generated_at: new Date().toISOString(),
    notes: "Wafilife metadata-only scrape from public product sitemaps and product JSON-LD; no cart, account, or file endpoints fetched.",
    sitemap_product_maps: productMaps.length,
    sitemap_product_urls: urls.length,
    fetched_this_run: queue.length,
    errors: errors.length,
    records: state.rows,
    files: {
      books: `${sourceSlug}/${runId}/${source}/books.jsonl`,
      sitemap_product_urls: `${sourceSlug}/${runId}/${source}/sitemap-product-urls.jsonl`,
      errors: `${sourceSlug}/${runId}/${source}/errors.jsonl`
    }
  });
  return state.rows;
}

function parseBaatigharCards(html, baseUrl, page) {
  const $ = cheerio.load(html);
  const rows = [];
  $(".active_products_grid_view .card.h-100, .oe_product .card.h-100, .card.h-100").each((_, node) => {
    const card = $(node);
    const link = card.find("a[href]").filter((__, linkNode) => /\/shop\/[^/?#]+-\d+(?:[?#]|$)/i.test($(linkNode).attr("href") || "")).first();
    const url = safeUrl(link.attr("href"), baseUrl);
    if (!url || !/baatighar\.com\/shop\//i.test(url)) return;
    const sourceId = sourceIdFromLastPath(url)?.match(/-(\d+)$/)?.[1] || sourceIdFromLastPath(url);
    const isbnFromSlug = sourceIdFromLastPath(url)?.replace(/-\d+$/, "") || null;
    const title = cleanText(card.find(".card_title a").first().text()) || cleanText(card.find(".card_title").first().text());
    const author = cleanText(card.find(".card_contributor_wrap span").first().text()) || cleanText(card.find(".card_contributer_title").first().text());
    if (!title) return;
    rows.push({
      source: "Baatighar",
      source_slug: "baatighar",
      source_id: sourceId,
      url,
      retrieved_at: retrievedAt,
      title,
      contributors: contributorsFromNames(author),
      isbn: /^\d[\dXx-]+$/.test(isbnFromSlug || "") ? isbnFromSlug : null,
      listing_page: page,
      raw_author: author,
      raw_listing_text: cleanText(card.text())?.slice(0, 500) || null
    });
  });
  return rows;
}

async function scrapeBaatighar() {
  const source = "baatighar";
  const baseUrl = "https://baatighar.com";
  const sourceDir = path.join(runDir, source);
  ensureDir(sourceDir);
  const state = sourceState(sourceDir);
  const catalogPagesPath = path.join(sourceDir, "catalog-pages.jsonl");
  const pageRows = readJsonl(catalogPagesPath);
  const completedPageUrls = completedCatalogPageUrls(pageRows);
  const booksByListingPage = new Map();
  for (const row of state.existingRows) {
    if (Number(row.listing_page) > 0) {
      booksByListingPage.set(Number(row.listing_page), (booksByListingPage.get(Number(row.listing_page)) || 0) + 1);
    }
  }
  for (const row of pageRows) {
    if (row.url && Number(row.product_cards) > 0 && (booksByListingPage.get(Number(row.page)) || 0) >= Number(row.product_cards)) {
      completedPageUrls.add(row.url);
    }
  }
  let page = Number(process.env.BAATIGHAR_START_PAGE || 1);
  let pagesChecked = 0;
  let duplicateRows = 0;
  let fetchErrors = 0;
  let stopReason = "completed";
  const seenPageSignatures = new Set();

  const robots = await fetchOptionalText(`${baseUrl}/robots.txt`, { accept: "text/plain,*/*" });
  fs.writeFileSync(path.join(sourceDir, "robots.txt"), robots.text || robots.error || "", "utf8");
  const sitemap = await fetchOptionalText(`${baseUrl}/sitemap.xml`, { accept: "application/xml,text/xml,*/*" });
  fs.writeFileSync(path.join(sourceDir, "sitemap.xml"), sitemap.text || sitemap.error || "", "utf8");

  let nextPage = page;
  let stopAtPage = Infinity;

  async function baatigharWorker() {
    for (;;) {
      if (limits.baatighar && state.rows >= limits.baatighar) {
        stopReason = "limit";
        stopAtPage = Math.min(stopAtPage, nextPage);
        return;
      }
      if (pageLimits.baatighar && pagesChecked >= pageLimits.baatighar) {
        stopReason = "page_limit";
        stopAtPage = Math.min(stopAtPage, nextPage);
        return;
      }

      const currentPage = nextPage;
      nextPage += 1;
      if (currentPage >= stopAtPage) return;
      if (pageLimits.baatighar && currentPage > pageLimits.baatighar) {
        stopReason = "page_limit";
        stopAtPage = Math.min(stopAtPage, currentPage);
        return;
      }

      const pageUrl = currentPage === 1 ? `${baseUrl}/shop` : `${baseUrl}/shop/page/${currentPage}`;
      if (completedPageUrls.has(pageUrl)) continue;

      let response;
      try {
        response = await fetchText(pageUrl);
      } catch (error) {
        fetchErrors += 1;
        pageRows.push({ page: currentPage, url: pageUrl, error: error.message });
        if (pageRows.length % 50 === 0) {
          pageRows.sort((left, right) => (Number(left.page) || 0) - (Number(right.page) || 0));
          writeJsonl(catalogPagesPath, pageRows);
        }
        console.log(`[baatighar] page ${currentPage}: fetch error (${fetchErrors} total)`);
        if (delayMs) await sleep(delayMs);
        continue;
      }

      if (currentPage >= stopAtPage) return;

      pagesChecked += 1;
      const rows = parseBaatigharCards(response.text, response.final_url, currentPage);
      const signature = rows.map((row) => row.url).join("|");
      if (!rows.length || seenPageSignatures.has(signature)) {
        stopReason = rows.length ? "duplicate_page_signature" : "empty_page";
        stopAtPage = Math.min(stopAtPage, currentPage);
        return;
      }
      seenPageSignatures.add(signature);

      let added = 0;
      for (const row of rows) {
        if (state.seenUrls.has(row.url)) {
          duplicateRows += 1;
          continue;
        }
        state.seenUrls.add(row.url);
        appendJsonl(state.booksPath, row);
        state.rows += 1;
        added += 1;
        if (limits.baatighar && state.rows >= limits.baatighar) break;
      }

      pageRows.push({ page: currentPage, url: pageUrl, final_url: response.final_url, product_cards: rows.length, added });
      completedPageUrls.add(pageUrl);
      if (pageRows.length % 50 === 0) {
        pageRows.sort((left, right) => (Number(left.page) || 0) - (Number(right.page) || 0));
        writeJsonl(catalogPagesPath, pageRows);
      }
      console.log(`[baatighar] page ${currentPage}: ${added}/${rows.length} added (${state.rows} total)`);

      if (limits.baatighar && state.rows >= limits.baatighar) {
        stopReason = "limit";
        stopAtPage = Math.min(stopAtPage, currentPage + 1);
        return;
      }
      if (delayMs) await sleep(delayMs);
    }
  }

  await Promise.all(Array.from({ length: baatigharPageFetchConcurrency }, () => baatigharWorker()));

  pageRows.sort((left, right) => (Number(left.page) || 0) - (Number(right.page) || 0));
  writeJsonl(catalogPagesPath, pageRows);
  writeSourceManifest(sourceDir, {
    source: "Baatighar",
    source_slug: source,
    run_id: runId,
    retrieved_at: retrievedAt,
    generated_at: new Date().toISOString(),
    notes: "Baatighar metadata-only scrape from public shop listing cards because sitemap is currently returning server errors; no cart, account, or file endpoints fetched.",
    pages_checked: pagesChecked,
    duplicate_rows: duplicateRows,
    errors: fetchErrors,
    records: state.rows,
    stop_reason: stopReason,
    files: {
      books: `${sourceSlug}/${runId}/${source}/books.jsonl`,
      catalog_pages: `${sourceSlug}/${runId}/${source}/catalog-pages.jsonl`
    }
  });
  return state.rows;
}

async function main() {
  ensureDir(runDir);
  const counts = {};
  if (selectedSources.has("boibazar")) counts.boibazar = await scrapeBoibazar();
  if (selectedSources.has("eboighar")) counts.eboighar = await scrapeEboighar();
  if (selectedSources.has("wafilife")) counts.wafilife = await scrapeWafilife();
  if (selectedSources.has("baatighar")) counts.baatighar = await scrapeBaatighar();

  const aggregateCounts = { ...counts };
  for (const slug of ["boibazar", "eboighar", "wafilife", "baatighar"]) {
    const manifestPath = path.join(runDir, slug, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (Number.isFinite(Number(manifest.records))) aggregateCounts[slug] = Number(manifest.records);
    } catch {
      // Keep the top-level manifest best-effort; source manifests remain authoritative.
    }
  }

  writeJson(path.join(runDir, "manifest.json"), {
    source_slug: sourceSlug,
    run_id: runId,
    retrieved_at: retrievedAt,
    generated_at: new Date().toISOString(),
    updated_sources: Array.from(selectedSources),
    counts: aggregateCounts,
    notes: "Medium retailer metadata scrape for Boibazar, eBoighar, Wafilife, and Baatighar. The scraper records catalog metadata only and refuses file, cart, checkout, account, and unexpected-host endpoints."
  });
  console.log(JSON.stringify({ run_id: runId, output: `${sourceSlug}/${runId}`, counts: aggregateCounts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
