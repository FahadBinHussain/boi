const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { archiveDir } = require("./paths");

const sourceName = "BanglaBoiPDF";
const baseUrl = "https://banglaboipdf.com";
const retrievedAt = process.env.DATASET_RETRIEVED_AT || new Date().toISOString().slice(0, 10);
const runId = process.env.BANGLABOIPDF_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(archiveDir, "banglaboipdf", runId);
const limit = Number(process.env.BANGLABOIPDF_LIMIT || 0);
const pageSize = Math.min(100, Math.max(1, Number(process.env.BANGLABOIPDF_PAGE_SIZE || 100)));
const delayMs = Number(process.env.BANGLABOIPDF_DELAY_MS || 250);

const endpoints = {
  robots: `${baseUrl}/robots.txt`,
  posts: `${baseUrl}/wp-json/wp/v2/posts`,
  categories: `${baseUrl}/wp-json/wp/v2/categories`,
  tags: `${baseUrl}/wp-json/wp/v2/tags`
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

function withParams(url, params) {
  const parsed = new URL(url);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) parsed.searchParams.set(name, String(value));
  }
  return parsed.toString();
}

function assertAllowedFetch(url) {
  const parsed = new URL(url, baseUrl);
  const host = parsed.hostname.toLowerCase();
  if (host !== "banglaboipdf.com" && host !== "www.banglaboipdf.com") {
    throw new Error(`Refusing to fetch non-BanglaBoiPDF URL: ${url}`);
  }
  if (/\.(?:pdf|epub|mobi|zip|rar|7z)(?:$|\?)/i.test(parsed.pathname)) {
    throw new Error(`Refusing to fetch BanglaBoiPDF file endpoint: ${url}`);
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
          accept: options.accept || "application/json,text/plain,*/*",
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

async function fetchJson(url) {
  const response = await fetchText(url);
  return { data: JSON.parse(response.text), headers: response.headers };
}

async function fetchCollection({ name, url, fields, maxRows = 0 }) {
  const rawDir = path.join(runDir, "api", name);
  const rows = [];
  let total = null;
  let totalPages = 1;

  for (let page = 1; page <= totalPages; page += 1) {
    const pageUrl = withParams(url, {
      per_page: pageSize,
      page,
      _fields: fields
    });
    const { data, headers } = await fetchJson(pageUrl);
    if (!Array.isArray(data)) throw new Error(`Expected array from ${pageUrl}`);

    if (page === 1) {
      total = Number(headers["x-wp-total"] || data.length);
      totalPages = Number(headers["x-wp-totalpages"] || 1);
    }

    writeJson(path.join(rawDir, `${String(page).padStart(4, "0")}.json`), data.map(sanitizeRawPost));
    rows.push(...data);
    console.log(`${name}: page ${page}/${totalPages}, rows ${rows.length}${total ? `/${total}` : ""}`);

    if (maxRows && rows.length >= maxRows) return rows.slice(0, maxRows);
    if (page < totalPages) await sleep(delayMs);
  }

  return rows;
}

function rendered(value) {
  return cleanText(value?.rendered || value);
}

function htmlText(html) {
  const withBreaks = String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|li|div|figure|h[1-6]|tr)>/gi, "\n");
  const $ = cheerio.load(withBreaks);
  $("script,style,noscript").remove();
  return cleanMultiline($.root().text());
}

function imageFromContent(html) {
  const $ = cheerio.load(html || "");
  const src = $("img")
    .map((_, node) => $(node).attr("src"))
    .get()
    .find(Boolean);
  if (!src) return null;
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return null;
  }
}

function linkInventory(html) {
  const $ = cheerio.load(html || "");
  const hosts = {};
  let fileLike = 0;
  let directDownloads = 0;

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
    if (/\.(?:pdf|epub|mobi|zip|rar|7z)(?:$|\?)/i.test(parsed.pathname)) fileLike += 1;
    if (
      /(?:mediafire|drive\.google|docs\.google|mega\.nz|dropbox|archive\.org|telegram|t\.me|wa\.me)/i.test(host) ||
      /\b(?:download|collect|read(?:-|\s)?online|pdf)\b/i.test(cleanText($(node).text()) || "")
    ) {
      directDownloads += 1;
    }
  });

  return {
    link_hosts: hosts,
    omitted_download_link_count: directDownloads,
    omitted_file_like_link_count: fileLike
  };
}

function matchField(text, labels) {
  const lines = String(text || "").split(/\n+/).map(cleanText).filter(Boolean);
  for (const label of labels) {
    const pattern = new RegExp(`^${label}\\s*[-:]\\s*(.+)$`, "iu");
    const line = lines.find((value) => pattern.test(value));
    const match = line?.match(pattern);
    if (match) return cleanText(match[1]);
  }
  return null;
}

function numberFrom(value) {
  const match = cleanText(value)?.match(/\d[\d,]*/);
  return match ? Number(match[0].replace(/,/g, "")) : null;
}

function parsePost(post, categoryById, tagById) {
  const contentHtml = post.content?.rendered || "";
  const bodyText = htmlText(contentHtml);
  const links = linkInventory(contentHtml);
  const categories = (post.categories || []).map((id) => categoryById.get(id)).filter(Boolean);
  const tags = (post.tags || []).map((id) => tagById.get(id)).filter(Boolean);
  const rawTitle = rendered(post.title);
  const bookName =
    matchField(bodyText, ["Book name", "Book Name", "ebook name", "Ebook name", "Book"]) ||
    rawTitle?.replace(/\b(?:Bengali|Bangla)\s+(?:ebook|book)\s+Pdf\b/i, "").replace(/\bPDF\b/gi, "").trim() ||
    rawTitle;

  return {
    source: sourceName,
    source_id: String(post.id),
    url: post.link,
    retrieved_at: retrievedAt,
    title: cleanText(bookName),
    raw_post_title: rawTitle,
    slug: post.slug,
    date_published: cleanText(post.date),
    date_modified: cleanText(post.modified),
    author: matchField(bodyText, ["Author", "Written by", "Writer", "Compiler", "Collected by"]),
    editor_or_translator: matchField(bodyText, ["Editor and Translator", "Editor", "Translator", "Translated by"]),
    book_type: matchField(bodyText, ["Book type", "Book genre", "Genre"]),
    file_type: matchField(bodyText, ["File type", "File format"]),
    pages: numberFrom(matchField(bodyText, ["Pages", "Total pages"])),
    pdf_size: matchField(bodyText, ["PDF size", "File size", "Size"]),
    quality: matchField(bodyText, ["Quality"]),
    categories: categories.map((category) => category.name),
    tags: tags.map((tag) => tag.name),
    cover_url: imageFromContent(contentHtml),
    excerpt: rendered(post.excerpt),
    content_summary: bodyText ? cleanText(bodyText).slice(0, 700) : null,
    omitted_download_link_count: links.omitted_download_link_count,
    omitted_file_like_link_count: links.omitted_file_like_link_count,
    link_hosts: links.link_hosts,
    raw_api_path: `banglaboipdf/${runId}/api/posts`,
    warnings: [
      links.omitted_download_link_count ? "download_links_detected_not_fetched_or_stored" : null,
      links.omitted_file_like_link_count ? "file_like_links_detected_not_fetched_or_stored" : null
    ].filter(Boolean)
  };
}

function sanitizeRawPost(row) {
  if (!row?.content?.rendered) return row;
  const links = linkInventory(row.content.rendered);
  return {
    ...row,
    content: {
      text: htmlText(row.content.rendered),
      omitted_download_link_count: links.omitted_download_link_count,
      omitted_file_like_link_count: links.omitted_file_like_link_count,
      link_hosts: links.link_hosts
    }
  };
}

async function main() {
  ensureDir(runDir);

  const robots = await fetchText(endpoints.robots, { accept: "text/plain,*/*" });
  writeText(path.join(runDir, "robots.txt"), robots.text);

  const categories = await fetchCollection({
    name: "categories",
    url: endpoints.categories,
    fields: "id,count,name,slug,link"
  });
  const tags = await fetchCollection({
    name: "tags",
    url: endpoints.tags,
    fields: "id,count,name,slug,link"
  });
  const categoryById = new Map(categories.map((row) => [row.id, row]));
  const tagById = new Map(tags.map((row) => [row.id, row]));

  const posts = await fetchCollection({
    name: "posts",
    url: endpoints.posts,
    fields: "id,date,modified,slug,link,title,excerpt,content,categories,tags,featured_media",
    maxRows: limit
  });
  const books = posts.map((post) => parsePost(post, categoryById, tagById));

  writeJsonl(path.join(runDir, "categories.jsonl"), categories);
  writeJsonl(path.join(runDir, "tags.jsonl"), tags);
  writeJsonl(path.join(runDir, "books.jsonl"), books);
  writeJson(path.join(runDir, "manifest.json"), {
    source: sourceName,
    base_url: baseUrl,
    run_id: runId,
    retrieved_at: retrievedAt,
    metadata_only: true,
    file_downloads_fetched: false,
    counts: {
      categories: categories.length,
      tags: tags.length,
      books: books.length,
      omitted_download_link_mentions: books.reduce((total, row) => total + row.omitted_download_link_count, 0),
      omitted_file_like_link_mentions: books.reduce((total, row) => total + row.omitted_file_like_link_count, 0)
    },
    config: {
      limit,
      page_size: pageSize,
      delay_ms: delayMs
    },
    output_files: {
      books: `banglaboipdf/${runId}/books.jsonl`,
      categories: `banglaboipdf/${runId}/categories.jsonl`,
      tags: `banglaboipdf/${runId}/tags.jsonl`
    }
  });

  console.log(
    JSON.stringify(
      {
        run_id: runId,
        books: books.length,
        categories: categories.length,
        tags: tags.length,
        omitted_download_link_mentions: books.reduce((total, row) => total + row.omitted_download_link_count, 0)
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
