const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { archiveDir } = require("./paths");

const sourceSlug = "small-islamic-sources";
const retrievedAt = process.env.DATASET_RETRIEVED_AT || new Date().toISOString().slice(0, 10);
const runId = process.env.SMALL_ISLAMIC_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(archiveDir, sourceSlug, runId);
const delayMs = Number(process.env.SMALL_ISLAMIC_DELAY_MS || 300);
const selectedSources = new Set(
  (process.env.SMALL_ISLAMIC_SOURCES || "islamhouse,yshamsan,hadithone")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

const limits = {
  islamhouse: Number(process.env.ISLAMHOUSE_LIMIT || 0),
  yshamsan: Number(process.env.YSHAMSAN_LIMIT || 0),
  hadithone: Number(process.env.HADITHONE_LIMIT || 0)
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
    .replace(/&amp;/gi, "&")
    .replace(/&#8211;|&#8212;|–|—/g, "-")
    .replace(/&#8216;|&#8217;|[‘’]/g, "'")
    .replace(/&#8220;|&#8221;|[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function htmlText(html) {
  const withBreaks = String(html || "")
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, "\n")
    .replace(/(Author|Reveiwers?|Translators?|Publisher|Source|Download|লেখক|অনুবাদ|সম্পাদনা|প্রকাশক)\s*[:：]/giu, "\n$&");
  const $ = cheerio.load(withBreaks);
  $("script,style,noscript,svg").remove();
  return cleanText($.root().text());
}

function unique(values) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function summaryExcerpt(value, stopLabels = []) {
  let text = cleanText(value);
  if (!text) return null;
  if (stopLabels.length) {
    const labelAlternation = stopLabels.map((label) => label.source || label).join("|");
    const match = text.match(new RegExp(`^([\\s\\S]*?)(?=\\s*(?:${labelAlternation})\\s*[:：]|$)`, "iu"));
    text = cleanText(match?.[1] || text);
  }
  return text ? text.slice(0, 900) : null;
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function writeJsonl(filePath, rows) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");
}

function assertAllowedFetch(url) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const allowedHosts = new Set(["islamhouse.com", "www.islamhouse.com", "yshamsan.com", "www.yshamsan.com", "hadith.one"]);
  if (!allowedHosts.has(host)) {
    throw new Error(`Refusing to fetch unexpected host: ${url}`);
  }
  if (/\.(?:pdf|epub|mobi|doc|docx|zip|rar|7z)(?:$|\?)/i.test(parsed.pathname)) {
    throw new Error(`Refusing to fetch file endpoint: ${url}`);
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

function linkInventory($, root, baseUrl) {
  const hosts = {};
  let downloadLinks = 0;
  let fileLikeLinks = 0;

  root.find("a[href]").each((_, node) => {
    const href = $(node).attr("href");
    if (!href) return;
    let parsed = null;
    try {
      parsed = new URL(href, baseUrl);
    } catch {
      return;
    }
    if (!/^https?:$/i.test(parsed.protocol)) return;
    const host = parsed.hostname.toLowerCase();
    if (!host) return;
    hosts[host] = (hosts[host] || 0) + 1;
    if (/\.(?:pdf|epub|mobi|doc|docx|zip|rar|7z)(?:$|\?)/i.test(parsed.pathname)) fileLikeLinks += 1;
    if (
      /(?:download|dl|drive\.google|docs\.google|mediafire|mega\.nz|dropbox|archive\.org|d1\.islamhouse)/i.test(host) ||
      /\b(?:download|pdf|doc|epub)\b/i.test(cleanText($(node).text()) || "")
    ) {
      downloadLinks += 1;
    }
  });

  return {
    link_hosts: hosts,
    omitted_download_link_count: downloadLinks,
    omitted_file_like_link_count: fileLikeLinks
  };
}

function roleFromBanglaLabel(label) {
  if (/অনুবাদ|Translators?/iu.test(label)) return "translator";
  if (/সম্পাদনা|Reveiwers?|Reviewing|editor/iu.test(label)) return "editor";
  if (/প্রকাশক|Publisher|The Publisher/iu.test(label)) return "publisher";
  if (/লেখক|Author/iu.test(label)) return "author";
  return "contributor";
}

function splitPeople(value) {
  return unique(
    String(value || "")
      .split(/\s+-\s+|\s*(?:,|;|،| এবং | ও )\s*/u)
      .map(cleanText)
      .filter(Boolean)
  );
}

function extractContributors(text, labelPatterns, stopPatterns = []) {
  const contributors = [];
  const labelAlternation = labelPatterns.map((label) => label.source || label).join("|");
  const stopAlternation = [...labelPatterns, ...stopPatterns].map((label) => label.source || label).join("|");
  const pattern = new RegExp(`(${labelAlternation})\\s*[:：]\\s*([\\s\\S]*?)(?=\\s*(?:${stopAlternation})\\s*[:：]|$)`, "giu");
  for (const match of String(text || "").matchAll(pattern)) {
    const label = cleanText(match[1]);
    const role = roleFromBanglaLabel(label);
    for (const name of splitPeople(match[2])) {
      contributors.push({ name, role });
    }
  }
  return contributors;
}

function firstYear(value) {
  const matches = Array.from(String(value || "").matchAll(/\b(1[5-9]\d{2}|20\d{2})\b/g)).map((match) => Number(match[1]));
  return matches.length ? matches[matches.length - 1] : null;
}

function parseDateText(value) {
  return cleanText(String(value || "").match(/\b\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{4}\b(?:\s*,\s*\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{4}\b)?/u)?.[0]);
}

async function scrapeIslamHouse() {
  const source = "IslamHouse";
  const baseUrl = "https://islamhouse.com";
  const sourceDir = path.join(runDir, "islamhouse");
  const books = [];
  let expectedItems = null;

  const robots = await fetchText(`${baseUrl}/robots.txt`, { accept: "text/plain,*/*" });
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.writeFileSync(path.join(sourceDir, "robots.txt"), robots.text, "utf8");

  for (let page = 1; ; page += 1) {
    const pageUrl = `${baseUrl}/bn/books/bn/${page}`;
    const { text, final_url } = await fetchText(pageUrl);
    const $ = cheerio.load(text);
    const itemCountMatch = $("body").text().match(/আইটেম সংখ্যা\s*:?\s*(\d+)/u);
    if (itemCountMatch) expectedItems = Number(itemCountMatch[1]);

    const pageBooks = [];
    $("li.panel").each((_, node) => {
      const item = $(node);
      const titleLink = item.find("h3 a[href]").first();
      const title = cleanText(titleLink.text());
      const href = titleLink.attr("href");
      if (!title || !href) return;

      const url = new URL(href, baseUrl).toString();
      const sourceId = url.match(/\/books\/(\d+)\/?$/)?.[1] || null;
      const metaText = cleanText(item.find(".meta").text());
      const description = cleanText(item.find("p.lead").first().text());
      const contributors = [];
      item.find(".row.author em").each((_, contributorNode) => {
        const contributor = $(contributorNode);
        const labelText = cleanText(contributor.clone().children("a").remove().end().text());
        const role = roleFromBanglaLabel(labelText);
        const linkedNames = contributor
          .find("a")
          .map((_, linkNode) => cleanText($(linkNode).text()))
          .get()
          .filter(Boolean);
        const names = linkedNames.length
          ? linkedNames
          : splitPeople(String(labelText || "").replace(/^[^:：]+[:：]\s*/u, ""));
        for (const name of names) contributors.push({ name, role });
      });
      const links = linkInventory($, item, baseUrl);

      pageBooks.push({
        source,
        source_id: sourceId,
        url,
        retrieved_at: retrievedAt,
        title,
        language: "bn",
        format: cleanText(item.find(".badge strong").first().text()?.match(/\b(?:PDF|DOC|DOCX|HTML)\b/iu)?.[0] || metaText?.match(/\b(?:PDF|DOC|DOCX|HTML)\b/iu)?.[0]),
        date_text: parseDateText(metaText),
        publication_year: firstYear(metaText),
        contributors,
        authors: unique(contributors.filter((entry) => entry.role === "author").map((entry) => entry.name)),
        translators: unique(contributors.filter((entry) => entry.role === "translator").map((entry) => entry.name)),
        editors: unique(contributors.filter((entry) => entry.role === "editor").map((entry) => entry.name)),
        publishers: unique(contributors.filter((entry) => entry.role === "publisher").map((entry) => entry.name)),
        content_summary: summaryExcerpt(unique([title, description]).join(" ")),
        omitted_download_link_count: links.omitted_download_link_count,
        omitted_file_like_link_count: links.omitted_file_like_link_count,
        link_hosts: links.link_hosts,
        raw_page_url: final_url
      });
    });

    if (!pageBooks.length) break;
    books.push(...pageBooks);
    console.log(`IslamHouse: page ${page}, books ${books.length}${expectedItems ? `/${expectedItems}` : ""}`);
    if (limits.islamhouse && books.length >= limits.islamhouse) break;
    if (expectedItems && books.length >= expectedItems) break;
    await sleep(delayMs);
  }

  const rows = limits.islamhouse ? books.slice(0, limits.islamhouse) : books;
  writeJsonl(path.join(sourceDir, "books.jsonl"), rows);
  writeJson(path.join(sourceDir, "manifest.json"), {
    source,
    base_url: baseUrl,
    run_id: runId,
    retrieved_at: retrievedAt,
    metadata_only: true,
    file_downloads_fetched: false,
    counts: {
      books: rows.length,
      expected_items: expectedItems,
      omitted_download_link_mentions: rows.reduce((total, row) => total + row.omitted_download_link_count, 0),
      omitted_file_like_link_mentions: rows.reduce((total, row) => total + row.omitted_file_like_link_count, 0)
    },
    output_files: {
      books: `${sourceSlug}/${runId}/islamhouse/books.jsonl`
    }
  });
  return rows.length;
}

async function scrapeYShamsan() {
  const source = "YShamsan";
  const baseUrl = "http://www.yshamsan.com";
  const sourceDir = path.join(runDir, "yshamsan");
  const booksUrl = `${baseUrl}/books-bn.html`;
  const { text } = await fetchText(booksUrl);
  const $ = cheerio.load(text);
  const rows = [];

  $("h4 a.bookstitle[href]").each((_, node) => {
    const link = $(node);
    const item = link.closest("li");
    const title = cleanText(link.text());
    const href = link.attr("href");
    if (!title || !href) return;

    const textValue = htmlText(item.html());
    const contributors = extractContributors(textValue, [
      /Author/u,
      /Translators?/u,
      /Reveiwers?/u,
      /Publisher/u,
      /লেখক/u,
      /অনুবাদ/u,
      /সম্পাদনা/u,
      /প্রকাশক/u
    ], [/Source/u, /Download/u]);
    const sourceUrl = cleanText(textValue?.match(/Source:\s*(https?:\/\/\S+)/iu)?.[1]);
    const links = linkInventory($, item, baseUrl);

    rows.push({
      source,
      source_id: href.match(/book-details-(\d+)-bn\.html/i)?.[1] || null,
      url: new URL(href, baseUrl).toString(),
      retrieved_at: retrievedAt,
      title,
      language: "bn",
      source_url: sourceUrl,
      publication_year: firstYear(textValue),
      contributors,
      authors: unique(contributors.filter((entry) => entry.role === "author").map((entry) => entry.name)),
      translators: unique(contributors.filter((entry) => entry.role === "translator").map((entry) => entry.name)),
      editors: unique(contributors.filter((entry) => entry.role === "editor").map((entry) => entry.name)),
      publishers: unique(contributors.filter((entry) => entry.role === "publisher").map((entry) => entry.name)),
      content_summary: summaryExcerpt(textValue, [
        /Author/u,
        /Translators?/u,
        /Reveiwers?/u,
        /Publisher/u,
        /Source/u,
        /Download/u,
        /লেখক/u,
        /অনুবাদ/u,
        /সম্পাদনা/u,
        /প্রকাশক/u
      ]),
      omitted_download_link_count: links.omitted_download_link_count,
      omitted_file_like_link_count: links.omitted_file_like_link_count,
      link_hosts: links.link_hosts
    });
  });

  const selected = limits.yshamsan ? rows.slice(0, limits.yshamsan) : rows;
  writeJsonl(path.join(sourceDir, "books.jsonl"), selected);
  writeJson(path.join(sourceDir, "manifest.json"), {
    source,
    base_url: baseUrl,
    run_id: runId,
    retrieved_at: retrievedAt,
    metadata_only: true,
    file_downloads_fetched: false,
    warnings: ["site HTTPS certificate was expired during scrape; HTTP catalog page was used"],
    counts: {
      books: selected.length,
      omitted_download_link_mentions: selected.reduce((total, row) => total + row.omitted_download_link_count, 0),
      omitted_file_like_link_mentions: selected.reduce((total, row) => total + row.omitted_file_like_link_count, 0)
    },
    output_files: {
      books: `${sourceSlug}/${runId}/yshamsan/books.jsonl`
    }
  });
  console.log(`YShamsan: books ${selected.length}`);
  return selected.length;
}

function parseSitemapUrls(xml) {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((match) => cleanText(match[1])).filter(Boolean);
}

async function scrapeHadithOne() {
  const source = "Hadith.one";
  const baseUrl = "https://hadith.one";
  const sourceDir = path.join(runDir, "hadithone");

  const robots = await fetchText(`${baseUrl}/robots.txt`, { accept: "text/plain,*/*" });
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.writeFileSync(path.join(sourceDir, "robots.txt"), robots.text, "utf8");

  const sitemap = await fetchText(`${baseUrl}/books-bn-sitemap.xml`, { accept: "application/xml,text/xml,*/*" });
  const bookUrls = parseSitemapUrls(sitemap.text).filter((url) => /\/bn\/book\/\d+$/i.test(url));
  writeJsonl(
    path.join(sourceDir, "book-urls.jsonl"),
    bookUrls.map((url) => ({ url }))
  );

  const selectedUrls = limits.hadithone ? bookUrls.slice(0, limits.hadithone) : bookUrls;
  const booksPath = path.join(sourceDir, "books.jsonl");
  const rowByUrl = new Map(readJsonl(booksPath).map((row) => [row.url, row]));
  const rows = [];
  for (const [index, url] of selectedUrls.entries()) {
    const hadCachedRow = rowByUrl.has(url);
    let row = rowByUrl.get(url);
    if (!row) {
      const { text } = await fetchText(url);
      const $ = cheerio.load(text);
      const metaDescription = cleanText($('meta[name="description"]').attr("content"));
      const [metaTitle, metaAuthor] = (metaDescription || "").split(/\s+\|\s+/u).map(cleanText);
      const pageTitle = cleanText(($("title").first().text() || "").replace(/\s*-\s*Hadith\.one.*$/iu, ""));
      const h1Values = $("h1")
        .map((_, node) => cleanText($(node).text()))
        .get()
        .filter(Boolean)
        .filter((value) => value !== "HADITH.One");
      const title = metaTitle || h1Values.find((value) => !/^লেখকঃ/u.test(value)) || pageTitle;
      const author =
        metaAuthor ||
        cleanText(h1Values.find((value) => /^লেখকঃ/u.test(value))?.replace(/^লেখকঃ\s*/u, ""));
      const sourceId = url.match(/\/bn\/book\/(\d+)$/)?.[1] || null;

      row = {
        source,
        source_id: sourceId,
        url,
        retrieved_at: retrievedAt,
        title,
        language: "bn",
        publication_year: null,
        contributors: author ? [{ name: author, role: "author" }] : [],
        authors: author ? [author] : [],
        translators: [],
        editors: [],
        publishers: [],
        content_summary: metaDescription,
        omitted_download_link_count: 0,
        omitted_file_like_link_count: 0,
        link_hosts: {}
      };
      rowByUrl.set(url, row);
    }

    rows.push(row);

    if ((index + 1) % 25 === 0 || index + 1 === selectedUrls.length) {
      console.log(`Hadith.one: books ${index + 1}/${selectedUrls.length}`);
      writeJsonl(
        booksPath,
        selectedUrls
          .slice(0, index + 1)
          .map((selectedUrl) => rowByUrl.get(selectedUrl))
          .filter(Boolean)
      );
    }
    if (!hadCachedRow && index + 1 < selectedUrls.length) await sleep(delayMs);
  }

  writeJsonl(booksPath, rows);
  writeJson(path.join(sourceDir, "manifest.json"), {
    source,
    base_url: baseUrl,
    run_id: runId,
    retrieved_at: retrievedAt,
    metadata_only: true,
    file_downloads_fetched: false,
    counts: {
      sitemap_book_urls: bookUrls.length,
      books: rows.length,
      omitted_download_link_mentions: rows.reduce((total, row) => total + row.omitted_download_link_count, 0),
      omitted_file_like_link_mentions: rows.reduce((total, row) => total + row.omitted_file_like_link_count, 0)
    },
    output_files: {
      books: `${sourceSlug}/${runId}/hadithone/books.jsonl`,
      book_urls: `${sourceSlug}/${runId}/hadithone/book-urls.jsonl`
    }
  });
  return rows.length;
}

async function main() {
  ensureDir(runDir);
  const counts = {};
  if (selectedSources.has("islamhouse")) counts.islamhouse = await scrapeIslamHouse();
  if (selectedSources.has("yshamsan")) counts.yshamsan = await scrapeYShamsan();
  if (selectedSources.has("hadithone")) counts.hadithone = await scrapeHadithOne();

  for (const [slug, dirName] of [
    ["islamhouse", "islamhouse"],
    ["yshamsan", "yshamsan"],
    ["hadithone", "hadithone"]
  ]) {
    if (counts[slug] !== undefined) continue;
    const manifestPath = path.join(runDir, dirName, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (manifest.counts?.books !== undefined) counts[slug] = manifest.counts.books;
  }

  writeJson(path.join(runDir, "manifest.json"), {
    source: "Small Islamic catalog sources",
    run_id: runId,
    retrieved_at: retrievedAt,
    metadata_only: true,
    file_downloads_fetched: false,
    selected_sources: Object.keys(counts),
    counts,
    config: {
      delay_ms: delayMs,
      limits
    }
  });
  console.log(JSON.stringify({ run_id: runId, counts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
