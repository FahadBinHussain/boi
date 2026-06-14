const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { archiveDir } = require("./paths");

const sourceName = "Allboi";
const sourceSlug = "allboi";
const baseUrl = "https://allboi.com";
const retrievedAt = process.env.DATASET_RETRIEVED_AT || new Date().toISOString().slice(0, 10);
const runId = process.env.ALLBOI_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(archiveDir, sourceSlug, runId);
const limit = Number(process.env.ALLBOI_LIMIT || 0);
const delayMs = Number(process.env.ALLBOI_DELAY_MS || 50);

const endpoints = {
  robots: `${baseUrl}/robots.txt`,
  sitemap: `${baseUrl}/sitemap_index.xml`
};

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

function normalizeInternalUrl(url, fromUrl = baseUrl) {
  if (!url) return null;
  let parsed = null;
  try {
    parsed = new URL(url, fromUrl);
  } catch {
    return null;
  }
  if (parsed.hostname.toLowerCase() !== "allboi.com") return null;
  parsed.hash = "";
  return parsed.toString();
}

function pathOf(url) {
  try {
    return new URL(url, baseUrl).pathname;
  } catch {
    return "/";
  }
}

function assertAllowedFetch(url) {
  const parsed = new URL(url, baseUrl);
  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  if (host !== "allboi.com") throw new Error(`Refusing to fetch non-Allboi URL: ${url}`);
  if (
    pathname.startsWith("/wp-admin/") ||
    pathname.startsWith("/wp-json/wordpress-popular-posts") ||
    pathname.startsWith("/download-book") ||
    pathname.startsWith("/read-online") ||
    pathname.includes("/feed") ||
    pathname.includes("/comments/")
  ) {
    throw new Error(`Refusing to fetch disallowed Allboi path: ${url}`);
  }
  if (/\.(?:pdf|epub|mobi|zip|rar|7z)(?:$|\?)/i.test(pathname)) {
    throw new Error(`Refusing to fetch Allboi file endpoint: ${url}`);
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

function parseSitemapIndex(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("sitemap")
    .map((_, node) => ({
      loc: normalizeInternalUrl($(node).find("loc").first().text()),
      lastmod: cleanText($(node).find("lastmod").first().text())
    }))
    .get()
    .filter((entry) => entry.loc);
}

function parseBookSitemap(xml, sitemapUrl) {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("url")
    .map((_, node) => ({
      loc: normalizeInternalUrl($(node).find("loc").first().text()),
      lastmod: cleanText($(node).find("lastmod").first().text()),
      image_url: cleanText($(node).find("image\\:loc, loc").filter((__, locNode) => $(locNode).parents("image\\:image").length).first().text()),
      sitemap_url: sitemapUrl
    }))
    .get()
    .filter((entry) => entry.loc && /^\/books\/[^/]+\/?$/i.test(pathOf(entry.loc)));
}

function safeSitemapFileName(url) {
  try {
    return new URL(url).pathname.replace(/^\/+/, "").replace(/[^\w.-]+/g, "_") || "sitemap.xml";
  } catch {
    return "sitemap.xml";
  }
}

function cleanPageTitle(value) {
  return cleanText(String(value || "").replace(/^\[PDF\]\s*/i, "").replace(/\s*-\s*Allboi.*$/i, ""));
}

function numberFrom(value) {
  const text = cleanText(value);
  if (!text) return null;
  const normalizedDigits = text.replace(/[০-৯]/g, (digit) => "০১২৩৪৫৬৭৮৯".indexOf(digit));
  const match = normalizedDigits.match(/\d[\d,]*/);
  return match ? Number(match[0].replace(/,/g, "")) : null;
}

function imageFromPage($, sitemapImageUrl) {
  const image =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $(".single_book_page_header_thumb img").first().attr("data-src") ||
    $(".single_book_page_header_thumb img").first().attr("src") ||
    sitemapImageUrl;
  if (!image) return null;
  try {
    return new URL(image, baseUrl).toString();
  } catch {
    return null;
  }
}

function linkInventory($) {
  const hosts = {};
  let fileLike = 0;
  let directDownloads = 0;
  let blockedActionLinks = 0;
  const bodyHtml = $("body").html() || "";

  $("a[href], iframe[src], embed[src]").each((_, node) => {
    const href = $(node).attr("href") || $(node).attr("src");
    if (!href) return;
    let parsed = null;
    try {
      parsed = new URL(href, baseUrl);
    } catch {
      return;
    }
    const host = parsed.hostname.toLowerCase();
    hosts[host] = (hosts[host] || 0) + 1;
    if (/\.(?:pdf|epub|mobi|zip|rar|7z)(?:$|\?)/i.test(parsed.pathname)) fileLike += 1;
    const text = cleanText($(node).text()) || "";
    if (/download|ডাউনলোড|read-online|অনলাইনে|pdf/i.test(text) || /\/(?:download-book|read-online)\b/i.test(parsed.pathname)) {
      directDownloads += 1;
    }
    if (/\/(?:download-book|read-online)\b/i.test(parsed.pathname)) blockedActionLinks += 1;
  });

  const scriptActionMentions = (bodyHtml.match(/\/(?:download-book|read-online)\//gi) || []).length;
  const downloadTriggers = $(".download_btn_trigger").length;
  const readOnlineTriggers = $("a[href='#read_online'], .read_full_pdf_online").length;

  return {
    link_hosts: hosts,
    omitted_download_link_count: directDownloads + scriptActionMentions + downloadTriggers + readOnlineTriggers,
    omitted_file_like_link_count: fileLike,
    omitted_blocked_action_link_count: blockedActionLinks + scriptActionMentions
  };
}

function parseDownloadInfo($) {
  const result = {};
  $(".single_book_page_download_info_group li").each((_, node) => {
    const text = cleanText($(node).text());
    if (!text) return;
    const [rawKey, ...rest] = text.split(":");
    const key = cleanText(rawKey);
    const value = cleanText(rest.join(":"));
    if (!key || !value) return;
    if (/ইবুকের ধরণ/i.test(key)) result.file_type = value;
    else if (/ডাউনলোড/i.test(key)) result.download_count = numberFrom(value);
    else if (/মোট পৃষ্ঠা/i.test(key)) result.pages = numberFrom(value);
    else if (/সাইজ/i.test(key)) result.pdf_size = value;
    else if (/সময়/i.test(key)) result.reading_time = value;
  });
  return result;
}

function parseBookPage(html, sitemapRow) {
  const $ = cheerio.load(html || "");
  const downloadInfo = parseDownloadInfo($);
  const links = linkInventory($);
  const title = cleanText($(".single_book_name").first().text()) || cleanPageTitle($("title").first().text());
  const author = cleanText($(".single_book_author a").first().text()) || cleanText($(".single_book_author").first().text()?.replace(/^By\s*/i, ""));
  const genreRows = $(".single_book_page_header_genres a")
    .map((_, node) => ({
      name: cleanText($(node).text()),
      url: normalizeInternalUrl($(node).attr("href"))
    }))
    .get()
    .filter((row) => row.name);
  const postId = cleanText($(".download_btn_trigger").first().attr("data-id")) || cleanText(($("body").attr("class") || "").match(/single_book_(\d+)/)?.[1]);
  const description = cleanText($(".single_book_page_description_part p").first().text());
  const metaDescription = cleanText($('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content"));
  const rawTitle = cleanPageTitle($("title").first().text());

  return {
    source: sourceName,
    source_id: postId || pathOf(sitemapRow.loc).replace(/^\/books\/|\/$/g, ""),
    slug: decodeURIComponent(pathOf(sitemapRow.loc).replace(/^\/books\/|\/$/g, "")),
    url: sitemapRow.loc,
    retrieved_at: retrievedAt,
    title,
    title_bn: hasBangla(title) ? title : null,
    author,
    author_bn: hasBangla(author) ? author : null,
    author_url: normalizeInternalUrl($(".single_book_author a").first().attr("href")),
    raw_page_title: rawTitle,
    date_modified: cleanText($('meta[property="og:updated_time"]').attr("content") || sitemapRow.lastmod),
    file_type: downloadInfo.file_type || null,
    pages: downloadInfo.pages || numberFrom(metaDescription?.match(/has\s+([^,]+),/i)?.[1]),
    pdf_size: downloadInfo.pdf_size || cleanText(metaDescription?.match(/,\s*([^,]+?)\s+in Size/i)?.[1]),
    download_count: downloadInfo.download_count || null,
    reading_time: downloadInfo.reading_time || cleanText(metaDescription?.match(/reading time is\s+(.+?)\./i)?.[1]),
    genres: genreRows.map((row) => row.name),
    genre_urls: genreRows.map((row) => row.url).filter(Boolean),
    cover_url: imageFromPage($, sitemapRow.image_url),
    excerpt: description,
    meta_description: metaDescription,
    omitted_download_link_count: links.omitted_download_link_count,
    omitted_file_like_link_count: links.omitted_file_like_link_count,
    omitted_blocked_action_link_count: links.omitted_blocked_action_link_count,
    link_hosts: links.link_hosts,
    warnings: [
      !title ? "missing_title" : null,
      !author ? "missing_author" : null,
      links.omitted_download_link_count ? "download_actions_detected_not_fetched_or_stored" : null,
      links.omitted_file_like_link_count ? "file_like_links_detected_not_fetched_or_stored" : null
    ].filter(Boolean)
  };
}

async function archiveSitemaps() {
  const sitemapIndex = await fetchText(endpoints.sitemap, { accept: "text/xml,*/*" });
  writeText(path.join(runDir, "sitemap_index.xml"), sitemapIndex.text);
  const sitemapEntries = parseSitemapIndex(sitemapIndex.text);
  writeJsonl(path.join(runDir, "sitemap-index.jsonl"), sitemapEntries);

  const bookSitemaps = sitemapEntries.filter((entry) => /\/book-sitemap\d+\.xml$/i.test(pathOf(entry.loc)));
  const bookUrls = [];
  for (const [index, entry] of bookSitemaps.entries()) {
    const response = await fetchText(entry.loc, { accept: "text/xml,*/*" });
    writeText(path.join(runDir, "sitemaps", safeSitemapFileName(entry.loc)), response.text);
    const rows = parseBookSitemap(response.text, entry.loc);
    bookUrls.push(...rows);
    console.log(`sitemaps: ${index + 1}/${bookSitemaps.length}, book urls ${bookUrls.length}`);
    if (index + 1 < bookSitemaps.length) await sleep(delayMs);
  }

  writeJsonl(path.join(runDir, "book-urls.jsonl"), bookUrls);
  return {
    sitemap_index_entries: sitemapEntries.length,
    book_sitemaps: bookSitemaps.length,
    book_urls: bookUrls
  };
}

async function main() {
  ensureDir(runDir);

  const robots = await fetchText(endpoints.robots, { accept: "text/plain,*/*" });
  writeText(path.join(runDir, "robots.txt"), robots.text);

  const sitemapResult = await archiveSitemaps();
  const selectedBookUrls = limit ? sitemapResult.book_urls.slice(0, limit) : sitemapResult.book_urls;
  const books = [];
  const errors = [];

  for (const [index, row] of selectedBookUrls.entries()) {
    try {
      const response = await fetchText(row.loc);
      books.push(parseBookPage(response.text, row));
    } catch (error) {
      errors.push({ url: row.loc, error: error.message });
    }

    if ((index + 1) % 100 === 0 || index + 1 === selectedBookUrls.length) {
      console.log(`[${index + 1}/${selectedBookUrls.length}] parsed=${books.length} errors=${errors.length}`);
    }
    if (index + 1 < selectedBookUrls.length) await sleep(delayMs);
  }

  writeJsonl(path.join(runDir, "books.jsonl"), books);
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
    metadata_only: true,
    file_downloads_fetched: false,
    counts: {
      sitemap_index_entries: sitemapResult.sitemap_index_entries,
      book_sitemaps: sitemapResult.book_sitemaps,
      book_urls: sitemapResult.book_urls.length,
      checked: selectedBookUrls.length,
      parsed_books: books.length,
      errors: errors.length,
      skipped_due_to_limit: sitemapResult.book_urls.length - selectedBookUrls.length,
      books_with_bangla_title: books.filter((row) => hasBangla(row.title_bn)).length,
      omitted_download_action_mentions: books.reduce((total, row) => total + row.omitted_download_link_count, 0),
      omitted_file_like_link_mentions: books.reduce((total, row) => total + row.omitted_file_like_link_count, 0),
      omitted_blocked_action_mentions: books.reduce((total, row) => total + row.omitted_blocked_action_link_count, 0)
    },
    warnings,
    safety: {
      no_book_files_downloaded: true,
      download_book_path_not_fetched: true,
      read_online_path_not_fetched: true,
      admin_ajax_not_fetched: true,
      raw_detail_html_not_saved: true
    },
    config: {
      limit: limit || null,
      delay_ms: delayMs
    },
    output_files: {
      books: `${sourceSlug}/${runId}/books.jsonl`,
      book_urls: `${sourceSlug}/${runId}/book-urls.jsonl`,
      errors: `${sourceSlug}/${runId}/errors.jsonl`
    }
  };
  writeJson(path.join(runDir, "manifest.json"), manifest);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
