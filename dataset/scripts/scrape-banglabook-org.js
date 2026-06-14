const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { archiveDir } = require("./paths");

const sourceName = "BanglaBook.org";
const sourceSlug = "banglabook-org";
const baseUrl = "https://www.banglabook.org";
const retrievedAt = process.env.DATASET_RETRIEVED_AT || new Date().toISOString().slice(0, 10);
const runId = process.env.BANGLABOOK_ORG_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(archiveDir, sourceSlug, runId);
const limit = Number(process.env.BANGLABOOK_ORG_LIMIT || 0);
const categoryLimit = Number(process.env.BANGLABOOK_ORG_CATEGORY_LIMIT || 0);
const delayMs = Number(process.env.BANGLABOOK_ORG_DELAY_MS || 100);
const detailUrlFile = process.env.BANGLABOOK_ORG_DETAIL_URL_FILE || null;

const endpoints = {
  robots: `${baseUrl}/robots.txt`,
  sitemap: `${baseUrl}/sitemap.xml`,
  azList: `${baseUrl}/a-z-list/`,
  genres: `${baseUrl}/bangla-books-genres/`
};

const staticPathPatterns = [
  /^\/$/,
  /^\/(?:about-us|contact-us|privacy-policy|terms-of-service|a-z-list|bangla-books-genres|bengali-ebook|blog|chat|my-account|registration)\/?$/i
];

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
    .replace(/&#8211;|&#8212;|–|—/g, "-")
    .replace(/&#8216;|&#8217;|[‘’]/g, "'")
    .replace(/&#8220;|&#8221;|[“”]/g, '"')
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function cleanMultiline(value) {
  if (value === undefined || value === null) return null;
  const lines = String(value)
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map(cleanText)
    .filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}

function unique(values) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function hasBangla(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
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

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function normalizeInternalUrl(url, fromUrl = baseUrl) {
  if (!url) return null;
  let parsed = null;
  try {
    parsed = new URL(url, fromUrl);
  } catch {
    return null;
  }
  if (parsed.hostname.toLowerCase() !== "www.banglabook.org" && parsed.hostname.toLowerCase() !== "banglabook.org") return null;
  parsed.hash = "";
  parsed.search = "";
  if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";
  return parsed.toString();
}

function pathOf(url) {
  try {
    return new URL(url, baseUrl).pathname;
  } catch {
    return "/";
  }
}

function isStaticPage(url) {
  const pathname = pathOf(url);
  return staticPathPatterns.some((pattern) => pattern.test(pathname));
}

function isCategoryUrl(url) {
  return /^\/category\/[^?#]+\/$/i.test(pathOf(url));
}

function isDisallowedPath(url) {
  const pathname = pathOf(url).toLowerCase();
  return (
    pathname.startsWith("/wp-admin/") ||
    pathname.startsWith("/refer/") ||
    pathname.startsWith("/cgi-bin/") ||
    pathname.includes("/comments/") ||
    pathname.endsWith("/feed/") ||
    pathname === "/xmlrpc.php" ||
    pathname === "/wp-login.php"
  );
}

function isLikelyDetailUrl(url) {
  const normalized = normalizeInternalUrl(url);
  if (!normalized) return false;
  const pathname = pathOf(normalized);
  if (isStaticPage(normalized) || isCategoryUrl(normalized) || isDisallowedPath(normalized)) return false;
  if (/^\/(?:tag|author|page|wp-content|wp-json)\//i.test(pathname)) return false;
  if (/\/page\/\d+\/$/i.test(pathname)) return false;
  if (/\.(?:pdf|epub|mobi|zip|rar|7z|jpe?g|png|gif|webp|css|js)$/i.test(pathname)) return false;
  return true;
}

function assertAllowedFetch(url) {
  const parsed = new URL(url, baseUrl);
  const host = parsed.hostname.toLowerCase();
  if (host !== "banglabook.org" && host !== "www.banglabook.org") {
    throw new Error(`Refusing to fetch non-BanglaBook.org URL: ${url}`);
  }
  if (parsed.search) {
    throw new Error(`Refusing to fetch BanglaBook.org query-string URL blocked by robots: ${url}`);
  }
  if (isDisallowedPath(parsed.toString())) {
    throw new Error(`Refusing to fetch disallowed BanglaBook.org path: ${url}`);
  }
  if (/\.(?:pdf|epub|mobi|zip|rar|7z)(?:$|\?)/i.test(parsed.pathname)) {
    throw new Error(`Refusing to fetch BanglaBook.org file endpoint: ${url}`);
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
        final_url: normalizeInternalUrl(response.url || url) || response.url || url,
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
      loc: normalizeInternalUrl($(node).find("loc").first().text()),
      lastmod: cleanText($(node).find("lastmod").first().text())
    }))
    .get()
    .filter((row) => row.loc);
}

function extractInternalLinks(html, fromUrl) {
  const $ = cheerio.load(html || "");
  return unique(
    $("a[href]")
      .map((_, node) => normalizeInternalUrl($(node).attr("href"), fromUrl))
      .get()
  );
}

function extractCategoryLinks(html, fromUrl) {
  return extractInternalLinks(html, fromUrl).filter(isCategoryUrl);
}

function extractDetailLinks(html, fromUrl) {
  const $ = cheerio.load(html || "");
  const scoped = unique(
    $("article a[rel='bookmark'], article .entry-title a[href], article h1 a[href], article h2 a[href], article h3 a[href], .post-entry a[rel='bookmark'], .slide-entry a[href]")
      .map((_, node) => normalizeInternalUrl($(node).attr("href"), fromUrl))
      .get()
  ).filter(isLikelyDetailUrl);
  if (scoped.length) return scoped;
  return extractInternalLinks(html, fromUrl).filter(isLikelyDetailUrl);
}

function paginationMax(html, fromUrl) {
  const links = extractInternalLinks(html, fromUrl);
  let maxPage = 1;
  for (const link of links) {
    const match = pathOf(link).match(/\/page\/(\d+)\/$/i);
    if (match) maxPage = Math.max(maxPage, Number(match[1]));
  }
  return maxPage;
}

function categoryPageUrl(categoryUrl, pageNumber) {
  if (pageNumber <= 1) return categoryUrl;
  const parsed = new URL(categoryUrl);
  parsed.pathname = parsed.pathname.replace(/\/$/, `/page/${pageNumber}/`);
  return parsed.toString();
}

function htmlText(html) {
  const withBreaks = String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|li|div|figure|figcaption|h[1-6]|tr)>/gi, "\n");
  const $ = cheerio.load(withBreaks);
  $("script,style,noscript").remove();
  return cleanMultiline($.root().text());
}

function linkInventory(html) {
  const $ = cheerio.load(html || "");
  const hosts = {};
  let fileLike = 0;
  let directDownloads = 0;
  let referLinks = 0;

  $("a[href]").each((_, node) => {
    const href = $(node).attr("href");
    if (!href) return;
    let parsed = null;
    try {
      parsed = new URL(href, baseUrl);
    } catch {
      return;
    }
    const host = parsed.hostname.toLowerCase();
    hosts[host] = (hosts[host] || 0) + 1;
    if (host.endsWith("banglabook.org") && parsed.pathname.toLowerCase().startsWith("/refer/")) referLinks += 1;
    if (/\.(?:pdf|epub|mobi|zip|rar|7z)(?:$|\?)/i.test(parsed.pathname)) fileLike += 1;
    if (
      /(?:mediafire|drive\.google|docs\.google|mega\.nz|dropbox|box\.com|archive\.org|telegram|t\.me|wa\.me)/i.test(host) ||
      /\b(?:download|link|read|pdf|collect)\b/i.test(cleanText($(node).text()) || "") ||
      /বইটি\s+পড়ুন/i.test(cleanText($(node).text()) || "")
    ) {
      directDownloads += 1;
    }
  });

  return {
    link_hosts: hosts,
    omitted_download_link_count: directDownloads,
    omitted_file_like_link_count: fileLike,
    omitted_refer_link_count: referLinks
  };
}

function fieldFromText(text, labels) {
  const normalized = cleanText(text);
  if (!normalized) return null;
  const labelPattern = [
    "English Title",
    "Bangla Title",
    "Bengali Title",
    "Writer",
    "Author",
    "File Format",
    "Pages",
    "Book Size",
    "PDF Size",
    "File Size",
    "Quality",
    "Publisher",
    "ISBN",
    "Language"
  ].join("|");
  for (const label of labels) {
    const pattern = new RegExp(`\\b${label}\\b\\s*[-:]\\s*(.*?)(?=\\s+(?:${labelPattern})\\s*[-:]|$)`, "iu");
    const match = normalized.match(pattern);
    if (match) return cleanText(match[1]);
  }
  return null;
}

function numberFrom(value) {
  const match = cleanText(value)?.match(/\d[\d,]*/);
  return match ? Number(match[0].replace(/,/g, "")) : null;
}

function imageFromPage($) {
  const selectors = [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]'
  ];
  for (const selector of selectors) {
    const content = $(selector).attr("content");
    if (content) return content;
  }
  const img = $("article img, .entry-content img, main img")
    .map((_, node) => $(node).attr("src") || $(node).attr("data-src") || $(node).attr("data-lazy-src"))
    .get()
    .find(Boolean);
  if (!img) return null;
  try {
    return new URL(img, baseUrl).toString();
  } catch {
    return null;
  }
}

function titleFromPageTitle(value) {
  const title = cleanText(value);
  if (!title) return null;
  return cleanText(
    title
      .replace(/\s*[–-]\s*Bangla Book.*$/i, "")
      .replace(/Click to open.*$/i, "")
      .replace(/\s+/g, " ")
  );
}

function banglaTitleParts(text) {
  const line = String(text || "")
    .split(/\n+/)
    .map(cleanText)
    .find((value) => /^বাংলা\s+বই\s*-/i.test(value || ""));
  if (!line) return {};
  const beforePipe = line.split("|")[0];
  const pieces = beforePipe.split(/\s+-\s+/).map(cleanText).filter(Boolean);
  return {
    title_bn: pieces[1] || null,
    author_bn: pieces[2] || null
  };
}

function categoriesFromScope($, scope) {
  return unique(
    scope
      .find("a[href*='/category/']")
      .map((_, node) => cleanText($(node).text()))
      .get()
  );
}

function tagsFromScope($, scope) {
  return unique(
    scope
      .find("a[rel='tag'], a[href*='/tag/']")
      .map((_, node) => cleanText($(node).text()))
      .get()
  );
}

function stripPdfWords(value) {
  return cleanText(
    value
      ?.replace(/\bBangla\s+(?:PDF|Book)\b/gi, " ")
      .replace(/\bPDF\b/gi, " ")
      .replace(/\bpdf\b/g, " ")
      .replace(/\s+/g, " ")
  );
}

function parseRawTitleParts(rawTitle, text) {
  const result = {};
  const raw = cleanText(rawTitle);
  if (raw) {
    const [left, ...rightParts] = raw.split("|").map(cleanText).filter(Boolean);
    const banglaMatch = left?.match(/^(.+?)\s*(?:PDF|pdf|পিডিএফ)?\s*-\s*(.+)$/i);
    if (banglaMatch) {
      if (hasBangla(banglaMatch[1])) result.title_bn = stripPdfWords(banglaMatch[1]);
      if (hasBangla(banglaMatch[2])) result.author_bn = stripPdfWords(banglaMatch[2]);
    }

    const right = rightParts.join(" | ");
    if (right) {
      const cleanedRight = stripPdfWords(right);
      const pieces = cleanedRight?.split(/\s+-\s+/).map(cleanText).filter(Boolean) || [];
      if (pieces.length >= 2) {
        result.title_en = pieces.slice(0, -1).join(" - ");
        result.author_en = pieces[pieces.length - 1];
      } else if (pieces.length === 1 && !hasBangla(pieces[0])) {
        result.title_en = pieces[0];
      }
    }
  }

  const body = cleanText(text);
  if (body) {
    const banglaBody = body.match(/([\u0980-\u09FF][^|]{1,90}?)\s*(?:PDF|pdf|পিডিএফ)\s*-\s*([\u0980-\u09FF][^|]{1,90}?)(?=\s+[A-Za-z]| Tags:| Share|$)/i);
    if (banglaBody) {
      result.title_bn ||= stripPdfWords(banglaBody[1]);
      result.author_bn ||= stripPdfWords(banglaBody[2]);
    }

    const englishBody = body.match(/([A-Za-z][A-Za-z0-9 .,'&:;!?()/-]{2,}?)\s+(?:Bangla\s+)?PDF\s*-\s*([A-Za-z][A-Za-z .,'&()/-]{2,}?)(?=\s+(?:Tags:|Share|https?:)|$)/i);
    if (englishBody) {
      result.title_en ||= stripPdfWords(englishBody[1]);
      result.author_en ||= stripPdfWords(englishBody[2]);
    }
  }

  return result;
}

function parseDetailPage(html, url) {
  const $ = cheerio.load(html || "");
  const article = $("article").first();
  const articleHtml = article.html() || $(".entry-content-wrapper").first().html() || $("main").first().html() || html;
  const text = htmlText(articleHtml);
  const fullText = htmlText(html);
  const links = linkInventory(articleHtml);
  const titleParts = banglaTitleParts(text);
  const pageTitle = titleFromPageTitle($("title").first().text());
  const parsedTitle = parseRawTitleParts(pageTitle, text);
  const rawTitle = cleanText($("h1.entry-title, h1.post-title, h1").first().text()) || pageTitle;
  const title =
    fieldFromText(text, ["English Title", "Book Name"]) ||
    parsedTitle.title_en ||
    titleFromPageTitle(rawTitle) ||
    pageTitle;
  const author = fieldFromText(text, ["Writer", "Author"]) || parsedTitle.author_en || null;
  const downloadMarker = /বইটি\s+পড়ুন|\b(?:Link|Download)\s*[:-]?\s*\d*\b/i.test(fullText || "") || links.omitted_download_link_count > 0;

  return {
    source: sourceName,
    source_id: pathOf(url).replace(/^\/|\/$/g, ""),
    url,
    retrieved_at: retrievedAt,
    title: cleanText(title),
    title_bn: parsedTitle.title_bn || titleParts.title_bn,
    author: cleanText(author),
    author_bn: parsedTitle.author_bn || titleParts.author_bn,
    raw_page_title: pageTitle,
    date_published: cleanText($('meta[property="article:published_time"]').attr("content") || $("time[datetime]").first().attr("datetime")),
    date_modified: cleanText($('meta[property="article:modified_time"]').attr("content")),
    file_type: fieldFromText(text, ["File Format"]),
    pages: numberFrom(fieldFromText(text, ["Pages"])),
    pdf_size: fieldFromText(text, ["Book Size", "PDF Size", "File Size"]),
    publisher: fieldFromText(text, ["Publisher"]),
    isbn: fieldFromText(text, ["ISBN"]),
    language: fieldFromText(text, ["Language"]),
    categories: categoriesFromScope($, article.length ? article : $("main").first()),
    tags: tagsFromScope($, article.length ? article : $("main").first()),
    cover_url: imageFromPage($),
    content_summary: text ? cleanText(text).slice(0, 700) : null,
    omitted_download_link_count: links.omitted_download_link_count,
    omitted_file_like_link_count: links.omitted_file_like_link_count,
    omitted_refer_link_count: links.omitted_refer_link_count,
    link_hosts: links.link_hosts,
    flags: {
      download_marker_seen: downloadMarker,
      metadata_only: true
    },
    warnings: [
      !title ? "missing_title" : null,
      !author ? "missing_author" : null,
      !downloadMarker ? "download_marker_not_seen" : null,
      links.omitted_download_link_count ? "download_links_detected_not_fetched_or_stored" : null,
      links.omitted_file_like_link_count ? "file_like_links_detected_not_fetched_or_stored" : null,
      links.omitted_refer_link_count ? "refer_links_detected_not_fetched" : null
    ].filter(Boolean)
  };
}

async function discoverCategoryPages(seedPages) {
  const categoryUrls = new Set();
  for (const { name, url } of seedPages) {
    const response = await fetchText(url);
    writeText(path.join(runDir, "seed-pages", `${name}.html`), response.text);
    for (const categoryUrl of extractCategoryLinks(response.text, response.final_url)) categoryUrls.add(categoryUrl);
    await sleep(delayMs);
  }
  return Array.from(categoryUrls).sort();
}

async function crawlCategoryPages(categoryUrls) {
  const selectedCategoryUrls = categoryLimit ? categoryUrls.slice(0, categoryLimit) : categoryUrls;
  const pageRows = [];
  const detailUrls = new Set();
  const errors = [];

  for (const [categoryIndex, categoryUrl] of selectedCategoryUrls.entries()) {
    let firstPage = null;
    let maxPage = 1;
    try {
      firstPage = await fetchText(categoryUrl);
      const firstLinks = extractDetailLinks(firstPage.text, firstPage.final_url);
      firstLinks.forEach((url) => detailUrls.add(url));
      maxPage = paginationMax(firstPage.text, firstPage.final_url);
      pageRows.push({
        category_url: categoryUrl,
        page_url: categoryUrl,
        page_number: 1,
        pagination_max: maxPage,
        detail_urls_seen: firstLinks.length
      });
    } catch (error) {
      errors.push({ category_url: categoryUrl, page_url: categoryUrl, error: error.message });
      continue;
    }

    for (let pageNumber = 2; pageNumber <= maxPage; pageNumber += 1) {
      const pageUrl = categoryPageUrl(categoryUrl, pageNumber);
      try {
        await sleep(delayMs);
        const response = await fetchText(pageUrl);
        const links = extractDetailLinks(response.text, response.final_url);
        links.forEach((url) => detailUrls.add(url));
        pageRows.push({
          category_url: categoryUrl,
          page_url: pageUrl,
          page_number: pageNumber,
          pagination_max: maxPage,
          detail_urls_seen: links.length
        });
      } catch (error) {
        errors.push({ category_url: categoryUrl, page_url: pageUrl, error: error.message });
      }
    }

    if ((categoryIndex + 1) % 50 === 0 || categoryIndex + 1 === selectedCategoryUrls.length) {
      console.log(
        `categories: ${categoryIndex + 1}/${selectedCategoryUrls.length}, pages=${pageRows.length}, detail_urls=${detailUrls.size}, errors=${errors.length}`
      );
    }
    await sleep(delayMs);
  }

  return {
    selected_category_urls: selectedCategoryUrls.length,
    pageRows,
    detailUrls: Array.from(detailUrls).sort(),
    errors
  };
}

async function main() {
  ensureDir(runDir);

  const robots = await fetchText(endpoints.robots, { accept: "text/plain,*/*" });
  writeText(path.join(runDir, "robots.txt"), robots.text);

  let sitemapRows = [];
  let sitemapDetailUrls = [];
  let categoryUrls = [];
  let crawl = {
    selected_category_urls: 0,
    pageRows: [],
    errors: [],
    detailUrls: []
  };
  let detailUrls = [];

  if (detailUrlFile) {
    const sourcePath = path.resolve(detailUrlFile);
    const rows = readJsonl(sourcePath);
    detailUrls = unique(rows.map((row) => row.url || row.loc).filter(isLikelyDetailUrl));
    writeJson(path.join(runDir, "detail-url-inventory-source.json"), {
      source_file: sourcePath,
      rows: rows.length,
      usable_detail_urls: detailUrls.length
    });
  } else {
    const sitemap = await fetchText(endpoints.sitemap, { accept: "text/xml,*/*" });
    writeText(path.join(runDir, "sitemap.xml"), sitemap.text);
    sitemapRows = parseSitemap(sitemap.text);
    writeJsonl(path.join(runDir, "sitemap-urls.jsonl"), sitemapRows);

    const seedPages = [
      { name: "a-z-list", url: endpoints.azList },
      { name: "genres", url: endpoints.genres }
    ];
    categoryUrls = await discoverCategoryPages(seedPages);
    writeJsonl(
      path.join(runDir, "categories.jsonl"),
      categoryUrls.map((url) => ({ source: sourceName, url, retrieved_at: retrievedAt, slug: pathOf(url).replace(/^\/category\/|\/$/g, "") }))
    );

    crawl = await crawlCategoryPages(categoryUrls);
    writeJsonl(path.join(runDir, "category-pages.jsonl"), crawl.pageRows);
    writeJsonl(path.join(runDir, "category-errors.jsonl"), crawl.errors);

    sitemapDetailUrls = sitemapRows.map((row) => row.loc).filter(isLikelyDetailUrl);
    detailUrls = unique([...sitemapDetailUrls, ...crawl.detailUrls]);
  }

  const selectedDetailUrls = limit ? detailUrls.slice(0, limit) : detailUrls;
  writeJsonl(path.join(runDir, "detail-url-inventory.jsonl"), detailUrls.map((url) => ({ url })));

  const books = [];
  const detailErrors = [];
  for (const [index, url] of selectedDetailUrls.entries()) {
    try {
      const response = await fetchText(url);
      const row = parseDetailPage(response.text, response.final_url);
      if (row.flags.download_marker_seen || row.omitted_download_link_count || row.file_type || row.pages || row.pdf_size) {
        books.push(row);
      } else {
        detailErrors.push({ url, error: "detail page did not look like a downloadable book metadata page" });
      }
    } catch (error) {
      detailErrors.push({ url, error: error.message });
    }

    if ((index + 1) % 100 === 0 || index + 1 === selectedDetailUrls.length) {
      console.log(`[${index + 1}/${selectedDetailUrls.length}] parsed=${books.length} errors=${detailErrors.length}`);
    }
    if (index + 1 < selectedDetailUrls.length) await sleep(delayMs);
  }

  writeJsonl(path.join(runDir, "books.jsonl"), books);
  writeJsonl(path.join(runDir, "errors.jsonl"), detailErrors);

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
    metadata_only: true,
    file_downloads_fetched: false,
    counts: {
      sitemap_urls: sitemapRows.length,
      sitemap_detail_urls: sitemapDetailUrls.length,
      category_urls: categoryUrls.length,
      selected_category_urls: crawl.selected_category_urls,
      category_pages_checked: crawl.pageRows.length,
      category_page_errors: crawl.errors.length,
      detail_urls_discovered: detailUrls.length,
      checked_detail_urls: selectedDetailUrls.length,
      parsed_books: books.length,
      detail_errors: detailErrors.length,
      skipped_due_to_limit: detailUrls.length - selectedDetailUrls.length,
      omitted_download_link_mentions: books.reduce((total, row) => total + row.omitted_download_link_count, 0),
      omitted_file_like_link_mentions: books.reduce((total, row) => total + row.omitted_file_like_link_count, 0),
      omitted_refer_link_mentions: books.reduce((total, row) => total + row.omitted_refer_link_count, 0)
    },
    warnings,
    safety: {
      no_book_files_downloaded: true,
      wordpress_api_not_used_due_to_robots_query_disallow: true,
      query_string_urls_not_fetched: true,
      refer_paths_not_fetched: true,
      external_book_links_not_fetched: true,
      raw_detail_html_not_saved: true
    },
    config: {
      limit: limit || null,
      category_limit: categoryLimit || null,
      detail_url_file: detailUrlFile || null,
      delay_ms: delayMs
    },
    output_files: {
      books: `${sourceSlug}/${runId}/books.jsonl`,
      errors: `${sourceSlug}/${runId}/errors.jsonl`,
      ...(detailUrlFile
        ? {
            detail_url_inventory_source: `${sourceSlug}/${runId}/detail-url-inventory-source.json`
          }
        : {
            categories: `${sourceSlug}/${runId}/categories.jsonl`,
            category_pages: `${sourceSlug}/${runId}/category-pages.jsonl`
          })
    }
  };
  writeJson(path.join(runDir, "manifest.json"), manifest);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
