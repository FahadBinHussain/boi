const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { archiveDir } = require("./paths");

const sourceSlug = "strong-retailer-sources";
const retrievedAt = process.env.DATASET_RETRIEVED_AT || new Date().toISOString().slice(0, 10);
const runId = process.env.STRONG_RETAILER_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(archiveDir, sourceSlug, runId);
const delayMs = Number(process.env.STRONG_RETAILER_DELAY_MS || 250);
const concurrency = Math.max(1, Number(process.env.STRONG_RETAILER_CONCURRENCY || 3));
const selectedSources = new Set(
  (process.env.STRONG_RETAILER_SOURCES || "pbs,prothoma,kitabghor,bdbooks")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

const limits = {
  pbs: Number(process.env.PBS_LIMIT || 0),
  prothoma: Number(process.env.PROTHOMA_LIMIT || 0),
  kitabghor: Number(process.env.KITABGHOR_LIMIT || 0),
  bdbooks: Number(process.env.BDBOOKS_LIMIT || 0)
};

const pageLimits = {
  pbs: Number(process.env.PBS_PAGE_LIMIT || 0),
  bdbooks: Number(process.env.BDBOOKS_PAGE_LIMIT || 0)
};

const pbsPageFetchConcurrency = Math.max(1, Number(process.env.PBS_PAGE_FETCH_CONCURRENCY || 2));
const bdbooksDetailConcurrency = Math.max(1, Number(process.env.BDBOOKS_DETAIL_CONCURRENCY || 3));

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
      .split(/\s*(?:,|;|،|\||\/|\s+-\s+)\s*/u)
  );
}

function contributorsFromNames(names, role = "author") {
  return splitPeople(names).map((name) => ({ name, role }));
}

function firstYear(value) {
  const matches = Array.from(String(value || "").matchAll(/\b(1[5-9]\d{2}|20\d{2})\b/g)).map((match) => Number(match[1]));
  return matches.length ? matches[matches.length - 1] : null;
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

function allowedFetchHost(host) {
  return new Set([
    "pbs.com.bd",
    "www.pbs.com.bd",
    "prothoma.com",
    "www.prothoma.com",
    "kitabghor.com",
    "www.kitabghor.com",
    "bdbooks.net",
    "www.bdbooks.net"
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
  if (/\/(?:cart|checkout|my-account|account|login|register|signup|wishlist|users)(?:\/|$)/i.test(parsed.pathname)) {
    throw new Error(`Refusing to fetch account/cart endpoint: ${url}`);
  }
}

async function fetchText(url, options = {}) {
  assertAllowedFetch(url);
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(Number(options.timeoutMs || process.env.STRONG_RETAILER_FETCH_TIMEOUT_MS || 45000)),
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
      /(Author|Publisher|Edition|ISBN|Pages|Language|Country|Category|Subject|Title|Format|লেখক|অনুবাদক|সম্পাদক|প্রকাশনী|প্রকাশক|প্রকাশনা|বিষয়|বিষয়|পৃষ্ঠা|পৃষ্ঠা সংখ্যা|সংস্করণ|প্রথম প্রকাশ|প্রকাশের সাল|বাঁধাই|শিরোনাম|ভাষা)\s*[:：]?/giu,
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

function colonLabelValue(text, labels, stopLabels) {
  const labelPattern = labels.map(escapeRegExp).join("|");
  const stopPattern = stopLabels.map(escapeRegExp).join("|");
  const pattern = new RegExp(`(?:^|\\s)(?:${labelPattern})\\s*[:：]+\\s*([\\s\\S]*?)(?=\\s+(?:${stopPattern})\\s*[:：]?\\s|$)`, "iu");
  return cleanText(String(text || "").match(pattern)?.[1]);
}

function stripAfterAny(value, markers) {
  let text = cleanText(value);
  if (!text) return null;
  const positions = markers.map((marker) => text.search(marker)).filter((index) => index >= 0);
  if (positions.length) text = text.slice(0, Math.min(...positions));
  return cleanText(text);
}

function kitabghorInfoText($, fallbackText) {
  return (
    $("ul")
      .map((_, node) => {
        const text = cleanText($(node).text());
        return text && /নাম\s*[:：]/u.test(text) && /পৃষ্ঠা সংখ্যা|ভাষা|ISBN|বান্ডিং/u.test(text) && text.length < 1000 ? text : null;
      })
      .get()[0] || sliceFromMarker(fallbackText, ["নাম :", "নাম:"])
  );
}

function kitabghorSummaryText($, fallbackText) {
  return (
    $(".portlet-body")
      .map((_, node) => {
        const text = cleanText($(node).text());
        return text && /প্রকাশনী\s*[:：]/u.test(text) && /বিষ\s*য়|বিষয়/u.test(text) && text.length < 2500 ? text : null;
      })
      .get()[0] || fallbackText
  );
}

function cleanKitabghorField(value) {
  return stripAfterAny(value, [
    /৳/u,
    /\sপরিমান\s*[:：]?/u,
    /\sবিস্তারিত\s/u,
    /\sরিভিউ\s/u,
    /\sLoading\b/iu,
    /\sসঠিক মূল্য\s/u,
    /\sডেলিভারী\s/u,
    /\sLinks\s/u,
    /\sCompany\s/u,
    /\sMy Account\s/iu
  ]);
}

function cleanKitabghorPublisher(value) {
  return cleanKitabghorField(cleanText(value)?.replace(/^:+\s*/u, ""));
}

function cleanKitabghorEdition(value) {
  return cleanKitabghorField(cleanText(value)?.replace(/\s+sku\s*[:：]?[\s\S]*$/iu, ""));
}

function cleanKitabghorLanguage(value) {
  const text = cleanKitabghorField(value);
  if (!text) return null;
  if (/বাংলা|bangla|bengali/iu.test(text)) return "bangla";
  if (/ইংরেজি|ইংরেজী|english/iu.test(text)) return "english";
  if (/উর্দু|urdu/iu.test(text)) return "urdu";
  if (/আরবি|arabic/iu.test(text)) return "arabic";
  return text.length <= 32 ? text : null;
}

function cleanRetailerCategory(value) {
  return stripAfterAny(value, [
    /https?:\/\//iu,
    /৳/u,
    /\b\d+(?:\.\d+)?\s*BDT\b/iu,
    /\b\d+(?:\.\d+)?\s*টাকা\b/u,
    /\sNot Available\b/iu,
    /\sThis combination\b/iu,
    /\sস্টক আউট\b/u,
    /\sAdd to Wishlist\b/iu,
    /\sSocial Share\b/iu,
    /\sসারসংক্ষেপ\b/u,
    /\sবিবরণ\b/u,
    /\sগ্রাহকের রিভিউ\b/u,
    /\sBDBooks অ্যাপে\b/iu,
    /\sBDBOOKS\b/iu
  ]);
}

function cleanRetailerLanguage(value) {
  const text = cleanRetailerCategory(value);
  if (!text) return null;
  if (/বাংলা|bangla|bengali/iu.test(text)) return "bangla";
  if (/ইংরেজি|ইংরেজী|english/iu.test(text)) return "english";
  if (/উর্দু|urdu/iu.test(text)) return "urdu";
  if (/আরবি|arabic/iu.test(text)) return "arabic";
  return text.length <= 32 ? text : null;
}

function cleanBDBooksPerson(value) {
  const text = cleanRetailerCategory(value);
  if (!text || text.length > 120) return null;
  if (/(?:লগইন|রেজিস্টার|ক্যাটাগরিস|প্রকাশনী অফার|উইশলিস্ট|কার্ট|স্টেশনারি|আমার একাউন্ট)/u.test(text)) return null;
  return text;
}

function cleanBDBooksEdition(value) {
  const text = cleanRetailerCategory(value);
  if (!text || /^undefined$/iu.test(text)) return null;
  return text;
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

function safeUrl(value, baseUrl) {
  if (!value) return null;
  try {
    const parsed = new URL(value, baseUrl);
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    if (/\.(?:pdf|epub|mobi|zip|rar|7z)(?:$|\?)/i.test(parsed.pathname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
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

function parseSitemapUrls(xml, predicate = () => true) {
  return unique(
    Array.from(String(xml || "").matchAll(/<loc>\s*([^<]+)\s*<\/loc>/giu))
      .map((match) => cleanText(match[1]))
      .filter(Boolean)
      .filter(predicate)
  );
}

function sourceIdFromPath(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || null;
}

function sourceIdFromProductUrl(url) {
  const parsed = new URL(url);
  return parsed.pathname.match(/\/(?:book|product|shop)\/(?:.*?)(\d+)(?:\/|$)/i)?.[1] || sourceIdFromPath(url);
}

function coverFromMeta($, url) {
  return safeUrl($("meta[property='og:image']").attr("content") || $("meta[name='twitter:image']").attr("content"), url);
}

function titleFromMeta($, siteName) {
  const h1 = $("h1,h2")
    .map((_, node) => cleanText($(node).text()))
    .get()
    .find((value) => value && value.length > 1 && !/^৳/.test(value) && !/^(সঠিক মূল্য|ডেলিভারী|Links|Company|Pay With)$/iu.test(value));
  if (h1) return h1;
  const ogTitle = cleanText($("meta[property='og:title']").attr("content"));
  if (ogTitle) return ogTitle;
  return cleanText($("title").text().split("|")[0].replace(siteName || "", ""));
}

function extractBanglaContributorLabels(text) {
  const contributors = [];
  const pattern = /(?:লেখক|Author)\s*[:：]\s*([\s\S]*?)(?=\s+(?:লেখক|Author|অনুবাদক|Translator|সম্পাদক|Editor|প্রকাশনী|প্রকাশক|প্রকাশনা|বিষয়|বিষয়|পৃষ্ঠা|ISBN|৳|ক্যাটাগরি)\s*[:：]|$)/giu;
  for (const match of String(text || "").matchAll(pattern)) {
    contributors.push(...contributorsFromNames(match[1], "author"));
  }
  const translatorPattern = /(?:অনুবাদক|Translator)\s*[:：]\s*([\s\S]*?)(?=\s+(?:লেখক|Author|অনুবাদক|Translator|সম্পাদক|Editor|প্রকাশনী|প্রকাশক|প্রকাশনা|বিষয়|বিষয়|পৃষ্ঠা|ISBN|৳|ক্যাটাগরি)\s*[:：]|$)/giu;
  for (const match of String(text || "").matchAll(translatorPattern)) {
    contributors.push(...contributorsFromNames(match[1], "translator"));
  }
  const editorPattern = /(?:সম্পাদক|Editor)\s*[:：]\s*([\s\S]*?)(?=\s+(?:লেখক|Author|অনুবাদক|Translator|সম্পাদক|Editor|প্রকাশনী|প্রকাশক|প্রকাশনা|বিষয়|বিষয়|পৃষ্ঠা|ISBN|৳|ক্যাটাগরি)\s*[:：]|$)/giu;
  for (const match of String(text || "").matchAll(editorPattern)) {
    contributors.push(...contributorsFromNames(match[1], "editor"));
  }
  return contributors;
}

function dedupeContributors(contributors) {
  const seen = new Set();
  return contributors.filter((contributor) => {
    const identity = `${cleanText(contributor.name)?.toLowerCase()}|${contributor.role || "author"}`;
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function parseProthomaDetail(html, url) {
  const $ = cheerio.load(html);
  const text = htmlText(html);
  const title = titleFromMeta($, "Prothoma");
  if (!title) return null;

  const detailText = sliceFromMarker(text, ["শিরোনাম"]);
  const topAuthor = colonLabelValue(text, ["লেখক"], ["বিষয়", "বিষয়", "https://", "কার্টে", "Share"]);
  const rawAuthor = topAuthor || labelValue(detailText, ["লেখক"], ["প্রকাশক", "ISBN", "প্রকাশের সাল", "বাঁধাই", "পৃষ্ঠা সংখ্যা", "দেশ", "ভাষা"]);
  const publisher = labelValue(detailText, ["প্রকাশক"], ["ISBN", "প্রকাশের সাল", "বাঁধাই", "পৃষ্ঠা সংখ্যা", "দেশ", "ভাষা"]);
  const isbn = cleanText(labelValue(detailText, ["ISBN"], ["প্রকাশের সাল", "বাঁধাই", "পৃষ্ঠা সংখ্যা", "দেশ", "ভাষা"]))?.replace(/\s+/g, "");
  const yearText = labelValue(detailText, ["প্রকাশের সাল"], ["বাঁধাই", "পৃষ্ঠা সংখ্যা", "দেশ", "ভাষা"]);
  const binding = labelValue(detailText, ["বাঁধাই"], ["পৃষ্ঠা সংখ্যা", "দেশ", "ভাষা"]);
  const pages = numberFromText(labelValue(detailText, ["পৃষ্ঠা সংখ্যা"], ["দেশ", "ভাষা"]));
  const language = cleanRetailerLanguage(labelValue(detailText, ["ভাষা"], ["আলোর উৎস", "এই লেখকের"]));
  const category = cleanRetailerCategory(colonLabelValue(text, ["বিষয়", "বিষয়"], ["https://", "কার্টে", "Share"]));

  return {
    source: "Prothoma",
    source_slug: "prothoma",
    source_id: sourceIdFromProductUrl(url),
    url,
    retrieved_at: retrievedAt,
    title,
    contributors: dedupeContributors(contributorsFromNames(rawAuthor)),
    publishers: publisher ? [publisher] : [],
    publication_year: firstYear(yearText),
    edition: binding,
    isbn,
    pages,
    language,
    categories: unique([category]),
    cover_url: coverFromMeta($, url),
    raw_author: rawAuthor
  };
}

function parseKitabghorDetail(html, url) {
  const $ = cheerio.load(html);
  const text = htmlText(html);
  const title = titleFromMeta($, "Kitabghor.com");
  if (!title) return null;

  const summaryText = kitabghorSummaryText($, text);
  const detailText = kitabghorInfoText($, text);
  const contributors = extractBanglaContributorLabels(`${summaryText} ${detailText}`);
  const publisher =
    cleanKitabghorPublisher(colonLabelValue(summaryText, ["প্রকাশনী"], ["বিষয়", "বিষয়", "৳", "পরিমান", "পৃষ্ঠা", "ভাষা", "ISBN"])) ||
    cleanKitabghorPublisher(colonLabelValue(detailText, ["প্রকাশনী"], ["পৃষ্ঠা সংখ্যা", "ভাষা", "ISBN", "বান্ডিং", "প্রথম প্রকাশ"]));
  const category = cleanKitabghorField(colonLabelValue(summaryText, ["বিষয়", "বিষয়"], ["৳", "পরিমান", "বিস্তারিত"]));
  const pages = numberFromText(colonLabelValue(detailText, ["পৃষ্ঠা সংখ্যা"], ["ভাষা", "ISBN", "বান্ডিং", "প্রথম প্রকাশ"]));
  const language = cleanKitabghorLanguage(colonLabelValue(detailText, ["ভাষা"], ["ISBN", "বান্ডিং", "প্রথম প্রকাশ"]));
  const isbn = cleanText(colonLabelValue(detailText, ["ISBN"], ["বান্ডিং", "প্রথম প্রকাশ"]))?.replace(/\s+/g, "");
  const binding = cleanKitabghorEdition(colonLabelValue(detailText, ["বান্ডিং"], ["প্রথম প্রকাশ", "রিভিউ"]));
  const yearText = colonLabelValue(detailText, ["প্রথম প্রকাশ"], ["রিভিউ", "Loading"]);

  return {
    source: "Kitabghor",
    source_slug: "kitabghor",
    source_id: new URL(url).pathname.match(/\/details\/([^/]+)/i)?.[1] || sourceIdFromPath(url),
    url,
    retrieved_at: retrievedAt,
    title,
    contributors: dedupeContributors(contributors),
    publishers: publisher ? [publisher] : [],
    publication_year: firstYear(yearText),
    edition: binding,
    isbn,
    pages,
    language,
    categories: unique([category]),
    cover_url: coverFromMeta($, url),
    raw_author: contributors.map((contributor) => contributor.name).join("; ") || null
  };
}

function parseBDBooksDetail(html, url, listing = {}) {
  const $ = cheerio.load(html);
  const text = htmlText(html);
  const title = cleanText((titleFromMeta($, "BDBOOKS") || listing.title)?.replace(/\s+(?:hardcover|paperback)\s*$/iu, ""));
  if (!title || /^404\b/i.test(title)) return null;

  const productId = cleanText(html.match(/const\s+productId\s*=\s*"([^"]+)"/)?.[1]) || sourceIdFromPath(url);
  const detailText = sliceFromMarker(text, ["বইয়ের নাম", "বইয়ের নাম"]);
  const rawAuthor = cleanBDBooksPerson(
    (
      colonLabelValue(text, ["লেখক"], ["৳", "ক্যাটাগরি", "প্রকাশনী", "প্রকাশনা", "সংস্করণ", "সাব ক্যাটাগরি", "পৃষ্ঠা"]) ||
      labelValue(detailText, ["লেখক"], ["প্রকাশনা", "পৃষ্ঠা সংখ্যা", "সংস্করণ", "ভাষা"])
    )?.replace(/\s*৳[\s\S]*$/u, "")
  );
  const publisher =
    cleanRetailerCategory(colonLabelValue(text, ["প্রকাশনী"], ["সংস্করণ", "সাব ক্যাটাগরি", "পৃষ্ঠা", "সারা দেশে"])) ||
    cleanRetailerCategory(labelValue(detailText, ["প্রকাশনা"], ["পৃষ্ঠা সংখ্যা", "সংস্করণ", "ভাষা"]));
  const category = cleanRetailerCategory(colonLabelValue(text, ["ক্যাটাগরি"], ["প্রকাশনী", "সংস্করণ", "সাব ক্যাটাগরি", "পৃষ্ঠা"]));
  const subcategory = cleanRetailerCategory(colonLabelValue(text, ["সাব ক্যাটাগরি"], ["পৃষ্ঠা", "সারা দেশে", "সারসংক্ষেপ"]));
  const pages = numberFromText(
    colonLabelValue(text, ["পৃষ্ঠা সংখ্যা"], ["সারা দেশে", "সারসংক্ষেপ"]) ||
      labelValue(detailText, ["পৃষ্ঠা সংখ্যা"], ["সংস্করণ", "ভাষা"])
  );
  const edition =
    cleanBDBooksEdition(colonLabelValue(text, ["সংস্করণ"], ["সাব ক্যাটাগরি", "পৃষ্ঠা", "সারা দেশে"])) ||
    cleanBDBooksEdition(labelValue(detailText, ["সংস্করণ"], ["ভাষা"]));
  const language = cleanRetailerLanguage(labelValue(detailText, ["ভাষা"], ["গ্রাহকের", "সম্পর্কিত বই", "এই লেখকের"]));

  return {
    source: "BDBOOKS",
    source_slug: "bdbooks",
    source_id: productId,
    url,
    retrieved_at: retrievedAt,
    title,
    contributors: dedupeContributors(contributorsFromNames(rawAuthor)),
    publishers: publisher ? [publisher] : listing.publishers || [],
    publication_year: firstYear(edition),
    edition,
    pages,
    language,
    categories: unique([category, subcategory, ...(listing.categories || [])]),
    cover_url: coverFromMeta($, url) || listing.cover_url || null,
    raw_author: rawAuthor
  };
}

function parsePBSBookDetail(html, url, listing = {}) {
  const $ = cheerio.load(html);
  const text = htmlText(html);
  const title = titleFromMeta($, "PBS") || listing.title;
  if (!title) return null;

  const detailText = sliceFromMarker(text, ["Title:", "Publisher:"]);
  const publisher =
    colonLabelValue(text, ["প্রকাশনী"], ["বিষয়", "বিষয়", "৳", "প্রথমবার", "Related"]) ||
    labelValue(detailText, ["Publisher"], ["ISBN", "Edition", "Number of Pages", "Country", "Language"]);
  const isbn = cleanText(labelValue(detailText, ["ISBN"], ["Edition", "Number of Pages", "Country", "Language"]))?.replace(/\s+/g, "");
  const yearText = labelValue(detailText, ["Edition"], ["Number of Pages", "Country", "Language"]);
  const pages = numberFromText(labelValue(detailText, ["Number of Pages"], ["Country", "Language"]));
  const language = labelValue(detailText, ["Language"], ["If you find", "Loading", "Reviews"]);
  const category = colonLabelValue(text, ["বিষয়", "বিষয়"], ["৳", "প্রথমবার", "ORDER", "Related"]);
  const author =
    listing.raw_author ||
    cleanText($("title").text().match(/^(.*?)\s+(.+?)-এর\s+/u)?.[2]) ||
    null;

  return {
    source: "PBS",
    source_slug: "pbs",
    source_id: new URL(url).pathname.match(/\/book\/(\d+)/i)?.[1] || sourceIdFromPath(url),
    url,
    retrieved_at: retrievedAt,
    title,
    contributors: dedupeContributors(contributorsFromNames(author)),
    publishers: publisher ? [publisher] : [],
    publication_year: firstYear(yearText),
    edition: yearText,
    isbn,
    pages,
    language,
    categories: unique([category, ...(listing.categories || [])]),
    cover_url: coverFromMeta($, url) || listing.cover_url || null,
    raw_author: author
  };
}

async function scrapeSitemapDetailSource({ source, sourceName, baseUrl, sitemapPath, productPredicate, detailParser, notes }) {
  const sourceDir = path.join(runDir, source);
  ensureDir(sourceDir);
  const state = sourceState(sourceDir);
  const errors = [];

  const robots = await fetchOptionalText(`${baseUrl}/robots.txt`, { accept: "text/plain,*/*" });
  fs.writeFileSync(path.join(sourceDir, "robots.txt"), robots.text || robots.error || "", "utf8");
  const sitemap = await fetchText(`${baseUrl}${sitemapPath}`, { accept: "application/xml,text/xml,*/*" });
  fs.writeFileSync(path.join(sourceDir, "sitemap.xml"), sitemap.text, "utf8");

  const sitemapUrls = parseSitemapUrls(sitemap.text);
  const productUrls = [];
  const sitemapFiles = [];

  if (sitemapUrls.some((url) => /\.xml(?:$|\?)/i.test(url))) {
    await mapLimit(sitemapUrls, Math.min(2, concurrency), async (sitemapUrl, index) => {
      const response = await fetchText(sitemapUrl, { accept: "application/xml,text/xml,*/*" });
      const fileName = `sitemap-${index + 1}.xml`;
      fs.writeFileSync(path.join(sourceDir, fileName), response.text, "utf8");
      sitemapFiles.push(fileName);
      for (const url of parseSitemapUrls(response.text, productPredicate)) productUrls.push(url);
    });
  } else {
    productUrls.push(...sitemapUrls.filter(productPredicate));
  }

  const urls = unique(productUrls).sort();
  writeJsonl(
    path.join(sourceDir, "sitemap-product-urls.jsonl"),
    urls.map((url) => ({ url }))
  );

  const queue = urls.filter((url) => !state.seenUrls.has(url)).slice(0, limits[source] || undefined);
  let fetchedThisRun = 0;
  await mapLimit(queue, concurrency, async (url, index) => {
    try {
      const response = await fetchText(url);
      const row = detailParser(response.text, response.final_url);
      fetchedThisRun += 1;
      if (row && !state.seenUrls.has(row.url)) {
        appendJsonl(state.booksPath, row);
        state.seenUrls.add(row.url);
        if (row.source_id) state.seenIds.add(row.source_id);
        state.rows += 1;
      }
      if ((index + 1) % 100 === 0) {
        console.log(`[${source}] ${index + 1}/${queue.length} fetched (${state.rows} total)`);
      }
    } catch (error) {
      errors.push({ url, error: error.message });
      if (errors.length % 25 === 0) writeJsonl(path.join(sourceDir, "errors.jsonl"), errors);
    }
  });

  writeJsonl(path.join(sourceDir, "errors.jsonl"), errors);
  writeSourceManifest(sourceDir, {
    source: sourceName,
    source_slug: source,
    run_id: runId,
    retrieved_at: retrievedAt,
    generated_at: new Date().toISOString(),
    notes,
    sitemap_urls: sitemapUrls.length,
    sitemap_product_urls: urls.length,
    sitemap_files: sitemapFiles,
    fetched_this_run: fetchedThisRun,
    errors: errors.length,
    records: state.rows,
    files: {
      books: `${sourceSlug}/${runId}/${source}/books.jsonl`,
      sitemap_product_urls: `${sourceSlug}/${runId}/${source}/sitemap-product-urls.jsonl`
    }
  });
  return state.rows;
}

function parsePBSListingCards(html, baseUrl, category) {
  const $ = cheerio.load(html);
  const byUrl = new Map();
  $("a[href*='/book/']").each((_, node) => {
    const href = $(node).attr("href");
    const url = safeUrl(href, baseUrl);
    if (!url || !/pbs\.com\.bd\/book\/\d+/i.test(url)) return;
    const text = cleanText($(node).text());
    const current = byUrl.get(url) || { url, texts: [] };
    if (text) current.texts.push(text);
    const title = cleanText($(node).find("h4[title]").first().attr("title") || $(node).find("h4").first().text() || $(node).find("img[title]").first().attr("title"));
    const author = cleanText($(node).find("h6").first().text());
    if (title) current.title = title;
    if (author) current.raw_author = author;
    const image = safeUrl($(node).find("img").first().attr("src") || $(node).find("img").first().attr("data-src"), baseUrl);
    if (image) current.cover_url = image;
    byUrl.set(url, current);
  });

  const rows = [];
  for (const entry of byUrl.values()) {
    const sourceId = new URL(entry.url).pathname.match(/\/book\/(\d+)/i)?.[1] || null;
    const richText = entry.texts.sort((a, b) => b.length - a.length)[0] || "";
    const moneyIndex = richText.search(/৳/u);
    const titleAuthor = cleanText(moneyIndex >= 0 ? richText.slice(0, moneyIndex) : richText);
    let title = entry.title || null;
    let rawAuthor = entry.raw_author || null;
    if (titleAuthor) {
      const split = titleAuthor.match(/^(.+?)([\p{Script=Bengali}A-Za-z][\p{Script=Bengali}A-Za-z .'-]{2,})$/u);
      title = title || cleanText(split?.[1]) || titleAuthor;
      rawAuthor = rawAuthor || cleanText(split?.[2]);
    }
    if (!title || title.length < 2) {
      title = cleanText(entry.texts.find((value) => value.length > 1));
    }
    if (!title) return;
    rows.push({
      source: "PBS",
      source_slug: "pbs",
      source_id: sourceId,
      url: entry.url,
      retrieved_at: retrievedAt,
      title,
      contributors: contributorsFromNames(rawAuthor),
      categories: category?.name ? [category.name] : [],
      category_slug: category?.slug || null,
      cover_url: entry.cover_url || null,
      raw_author: rawAuthor,
      raw_listing_text: richText.slice(0, 500)
    });
  }
  return rows;
}

function pbsCategoryFromUrl(url, name = null) {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/\/category\/(\d+)\/([^/]+)/i);
  if (!match) return null;
  return { id: match[1], slug: match[2], name: name || match[2], url: parsed.toString().replace("www.pbs.com.bd", "pbs.com.bd") };
}

function showingTotal(text) {
  return Number(cleanText(text)?.match(/Showing\s+\d+\s+to\s+\d+\s+of\s+([\d,]+)/i)?.[1]?.replace(/,/g, "")) || null;
}

async function scrapePBS() {
  const source = "pbs";
  const baseUrl = "https://pbs.com.bd";
  const sourceDir = path.join(runDir, source);
  ensureDir(sourceDir);
  const state = sourceState(sourceDir);
  const catalogPagesPath = path.join(sourceDir, "catalog-pages.jsonl");
  const pageRows = readJsonl(catalogPagesPath);
  const completedPages = new Set(pageRows.filter((row) => row.url && Number(row.product_cards) > 0).map((row) => row.url));
  let pagesChecked = 0;
  let pagesWithRows = 0;
  let duplicateRows = 0;
  let stopReason = "completed";

  const robots = await fetchOptionalText(`${baseUrl}/robots.txt`, { accept: "text/plain,*/*" });
  fs.writeFileSync(path.join(sourceDir, "robots.txt"), robots.text || robots.error || "", "utf8");
  const categorySources = await Promise.all([fetchText(`${baseUrl}/categories`), fetchText(`${baseUrl}/all-writer`), fetchText(`${baseUrl}/all-publisher`)]);
  const categoryMap = new Map();
  for (const { text, final_url } of categorySources) {
    const $ = cheerio.load(text);
    $("a[href*='/category/']").each((_, node) => {
      const url = safeUrl($(node).attr("href"), final_url);
      const category = url ? pbsCategoryFromUrl(url, cleanText($(node).text())) : null;
      if (!category || categoryMap.has(category.id)) return;
      categoryMap.set(category.id, category);
    });
  }

  const categories = Array.from(categoryMap.values()).sort((left, right) => Number(left.id) - Number(right.id));
  writeJson(path.join(sourceDir, "categories.json"), {
    retrieved_at: retrievedAt,
    source_pages: [`${baseUrl}/categories`, `${baseUrl}/all-writer`, `${baseUrl}/all-publisher`],
    count: categories.length,
    categories
  });

  for (const category of categories) {
    const firstResponse = await fetchText(category.url);
    const firstText = htmlText(firstResponse.text);
    const total = showingTotal(firstText);
    const pageCount = total ? Math.ceil(total / 40) : 1;
    const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
    for (let offset = 0; offset < pages.length; offset += pbsPageFetchConcurrency) {
      if (limits.pbs && state.rows >= limits.pbs) {
        stopReason = "limit";
        break;
      }
      if (pageLimits.pbs && pagesChecked >= pageLimits.pbs) {
        stopReason = "page_limit";
        break;
      }
      const batch = pages.slice(offset, offset + pbsPageFetchConcurrency).map((page) => {
        const url = page === 1 ? category.url : `${category.url}?page=${page}`;
        return { page, url };
      }).filter((entry) => !completedPages.has(entry.url));
      if (!batch.length) continue;

      const results = await Promise.all(
        batch.map(async (entry) => {
          try {
            const response = entry.page === 1 ? firstResponse : await fetchText(entry.url);
            return { ...entry, response };
          } catch (error) {
            return { ...entry, error };
          }
        })
      );

      for (const result of results.sort((left, right) => left.page - right.page)) {
        if (result.error) {
          pageRows.push({ category_slug: category.slug, page: result.page, url: result.url, error: result.error.message });
          continue;
        }
        pagesChecked += 1;
        const rows = parsePBSListingCards(result.response.text, result.response.final_url, category);
        if (!rows.length) {
          pageRows.push({ category_slug: category.slug, page: result.page, url: result.url, product_cards: 0, added: 0 });
          completedPages.add(result.url);
          continue;
        }
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
          if (limits.pbs && state.rows >= limits.pbs) break;
        }
        pageRows.push({
          category_slug: category.slug,
          category_name: category.name,
          page: result.page,
          url: result.url,
          final_url: result.response.final_url,
          total,
          product_cards: rows.length,
          added
        });
        completedPages.add(result.url);
        if (pageRows.length % 50 === 0) writeJsonl(catalogPagesPath, pageRows);
        console.log(`[pbs] ${category.slug} page ${result.page}/${pageCount}: ${added}/${rows.length} added (${state.rows} total)`);
      }
      if (delayMs) await sleep(delayMs);
    }
    if (stopReason !== "completed") break;
  }

  writeJsonl(catalogPagesPath, pageRows);
  writeSourceManifest(sourceDir, {
    source: "PBS",
    source_slug: source,
    run_id: runId,
    retrieved_at: retrievedAt,
    generated_at: new Date().toISOString(),
    notes: "PBS metadata-only scrape from public category listing cards; no cart, account, checkout, or file endpoints fetched.",
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

function parseBDBooksCards(html, apiUrl, category) {
  const $ = cheerio.load(html);
  const rows = [];
  const seen = new Set();
  $(".item, .product__items").each((_, node) => {
    const card = $(node);
    const link = card.find("a[href*='/product/']").first();
    const url = safeUrl(link.attr("href"), apiUrl);
    if (!url || seen.has(url)) return;
    if (new URL(url).pathname.replace(/^\/product\//i, "").includes("/")) return;
    seen.add(url);
    const title =
      cleanText(card.find(".product__items--content__title a, a[href*='/product/']").filter((__, item) => cleanText($(item).text())).first().text()) ||
      cleanText(link.text());
    const publisher = cleanText(card.find("a[href*='/publisher-single/']").first().text());
    const coverUrl = safeUrl(card.find("img[data-src], img[src]").first().attr("data-src") || card.find("img[data-src], img[src]").first().attr("src"), apiUrl);
    if (!title) return;
    rows.push({
      source: "BDBOOKS",
      source_slug: "bdbooks",
      source_id: sourceIdFromPath(url),
      url,
      retrieved_at: retrievedAt,
      title,
      contributors: [],
      publishers: publisher ? [publisher] : [],
      categories: category?.name ? [category.name] : [],
      category_slug: category?.slug || null,
      cover_url: coverUrl,
      raw_listing_text: cleanText(card.text())?.slice(0, 500) || null
    });
  });
  return rows;
}

function bdbooksCategoryFromUrl(url, name = null) {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/\/category\/(.+)$/i);
  if (!match) return null;
  const slug = decodeURIComponent(match[1]).trim();
  if (!slug || /\s/.test(slug) || /^(?:login|register|cart|categories|authors|publishers|campaigns)$/i.test(slug)) return null;
  return { slug, name: name || slug, url: parsed.toString() };
}

async function scrapeBDBooks() {
  const source = "bdbooks";
  const baseUrl = "https://bdbooks.net";
  const sourceDir = path.join(runDir, source);
  ensureDir(sourceDir);
  const state = sourceState(sourceDir);
  const catalogPagesPath = path.join(sourceDir, "catalog-pages.jsonl");
  const pageRows = readJsonl(catalogPagesPath);
  const completedPages = new Set(pageRows.filter((row) => row.url && Number(row.product_cards) > 0).map((row) => row.url));
  const errors = [];
  let pagesChecked = 0;
  let pagesWithRows = 0;
  let duplicateRows = 0;
  let stopReason = "completed";

  const robots = await fetchOptionalText(`${baseUrl}/robots.txt`, { accept: "text/plain,*/*" });
  fs.writeFileSync(path.join(sourceDir, "robots.txt"), robots.text || robots.error || "", "utf8");
  const sitemap = await fetchText(`${baseUrl}/sitemap.xml`, { accept: "application/xml,text/xml,*/*" });
  fs.writeFileSync(path.join(sourceDir, "sitemap.xml"), sitemap.text, "utf8");
  const categoriesPage = await fetchText(`${baseUrl}/categories/all`);
  fs.writeFileSync(path.join(sourceDir, "categories-all.html"), categoriesPage.text, "utf8");

  const categoryMap = new Map();
  for (const url of parseSitemapUrls(sitemap.text, (value) => /bdbooks\.net\/category\//i.test(value))) {
    const category = bdbooksCategoryFromUrl(url);
    if (category && !categoryMap.has(category.slug)) categoryMap.set(category.slug, category);
  }
  const $ = cheerio.load(categoriesPage.text);
  $("a[href*='/category/']").each((_, node) => {
    const url = safeUrl($(node).attr("href"), categoriesPage.final_url);
    const category = url ? bdbooksCategoryFromUrl(url, cleanText($(node).text())) : null;
    if (category && !categoryMap.has(category.slug)) categoryMap.set(category.slug, category);
  });

  const categories = Array.from(categoryMap.values()).sort((left, right) => left.slug.localeCompare(right.slug));
  writeJson(path.join(sourceDir, "categories.json"), {
    retrieved_at: retrievedAt,
    source_pages: [`${baseUrl}/sitemap.xml`, `${baseUrl}/categories/all`],
    count: categories.length,
    categories
  });

  for (const category of categories) {
    for (let page = 1; ; page += 1) {
      if (limits.bdbooks && state.rows >= limits.bdbooks) {
        stopReason = "limit";
        break;
      }
      if (pageLimits.bdbooks && pagesChecked >= pageLimits.bdbooks) {
        stopReason = "page_limit";
        break;
      }
      const apiUrl = `${baseUrl}/category/products/${encodeURIComponent(category.slug)}?page=${page}&sortBy=latest`;
      if (completedPages.has(apiUrl)) continue;
      let response;
      try {
        response = await fetchText(apiUrl, {
          accept: "application/json,text/html;q=0.8,*/*;q=0.7",
          headers: { "X-Requested-With": "XMLHttpRequest" }
        });
      } catch (error) {
        pageRows.push({ category_slug: category.slug, page, url: apiUrl, error: error.message });
        break;
      }
      pagesChecked += 1;
      let data;
      try {
        data = JSON.parse(response.text);
      } catch (error) {
        pageRows.push({ category_slug: category.slug, page, url: apiUrl, error: `Invalid JSON: ${error.message}` });
        break;
      }
      const listingRows = parseBDBooksCards(data.html || "", apiUrl, category);
      if (!listingRows.length) {
        pageRows.push({ category_slug: category.slug, page, url: apiUrl, product_cards: 0, added: 0 });
        break;
      }
      pagesWithRows += 1;
      let added = 0;
      await mapLimit(
        listingRows.filter((row) => !state.seenUrls.has(row.url)),
        bdbooksDetailConcurrency,
        async (listingRow) => {
          let row = listingRow;
          try {
            const detail = await fetchText(listingRow.url);
            row = parseBDBooksDetail(detail.text, detail.final_url, listingRow) || listingRow;
          } catch (error) {
            errors.push({ url: listingRow.url, error: error.message });
            if (/Fetch failed 404\b/.test(error.message)) row = null;
          }
          if (!row) return;
          if (state.seenUrls.has(row.url)) {
            duplicateRows += 1;
            return;
          }
          appendJsonl(state.booksPath, row);
          state.seenUrls.add(row.url);
          if (row.source_id) state.seenIds.add(row.source_id);
          state.rows += 1;
          added += 1;
        }
      );
      duplicateRows += listingRows.length - added;
      pageRows.push({
        category_slug: category.slug,
        category_name: category.name,
        page,
        url: apiUrl,
        product_cards: listingRows.length,
        added
      });
      completedPages.add(apiUrl);
      if (pageRows.length % 50 === 0) {
        writeJsonl(catalogPagesPath, pageRows);
        writeJsonl(path.join(sourceDir, "errors.jsonl"), errors);
      }
      console.log(`[bdbooks] ${category.slug} page ${page}: ${added}/${listingRows.length} added (${state.rows} total)`);
      if (delayMs) await sleep(delayMs);
    }
    if (stopReason !== "completed") break;
  }

  writeJsonl(catalogPagesPath, pageRows);
  writeJsonl(path.join(sourceDir, "errors.jsonl"), errors);
  writeSourceManifest(sourceDir, {
    source: "BDBOOKS",
    source_slug: source,
    run_id: runId,
    retrieved_at: retrievedAt,
    generated_at: new Date().toISOString(),
    notes: "BDBOOKS metadata-only scrape from public category pages and category product JSON responses; no cart, account, checkout, or file endpoints fetched.",
    categories: categories.length,
    pages_checked: pagesChecked,
    pages_with_rows: pagesWithRows,
    duplicate_rows: duplicateRows,
    errors: errors.length,
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

async function scrapeProthoma() {
  return scrapeSitemapDetailSource({
    source: "prothoma",
    sourceName: "Prothoma",
    baseUrl: "https://www.prothoma.com",
    sitemapPath: "/sitemap.xml",
    productPredicate: (url) => /prothoma\.com\/shop\/(?!category\/)[^/]+-\d+\/?$/i.test(url),
    detailParser: parseProthomaDetail,
    notes: "Prothoma metadata-only scrape from public product sitemaps and product detail pages; no cart, account, checkout, or file endpoints fetched."
  });
}

async function scrapeKitabghor() {
  return scrapeSitemapDetailSource({
    source: "kitabghor",
    sourceName: "Kitabghor",
    baseUrl: "https://www.kitabghor.com",
    sitemapPath: "/sitemap.xml",
    productPredicate: (url) => /kitabghor\.com\/products\/details\/[^/]+\/[^/]+\.html$/i.test(url),
    detailParser: parseKitabghorDetail,
    notes: "Kitabghor metadata-only scrape from public product sitemap and product detail pages; no cart, account, checkout, or file endpoints fetched."
  });
}

async function main() {
  ensureDir(runDir);
  const counts = {};
  if (selectedSources.has("pbs")) counts.pbs = await scrapePBS();
  if (selectedSources.has("prothoma")) counts.prothoma = await scrapeProthoma();
  if (selectedSources.has("kitabghor")) counts.kitabghor = await scrapeKitabghor();
  if (selectedSources.has("bdbooks")) counts.bdbooks = await scrapeBDBooks();

  writeJson(path.join(runDir, "manifest.json"), {
    source: "Strong retailer sources",
    source_slug: sourceSlug,
    run_id: runId,
    retrieved_at: retrievedAt,
    generated_at: new Date().toISOString(),
    notes: "Metadata-only scrape for PBS, Prothoma, Kitabghor, and BDBOOKS. The scraper records catalog metadata only and refuses file, cart, checkout, account, and unexpected-host endpoints.",
    counts,
    total_records: Object.values(counts).reduce((sum, count) => sum + count, 0)
  });
  console.log(JSON.stringify({ run_id: runId, counts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
