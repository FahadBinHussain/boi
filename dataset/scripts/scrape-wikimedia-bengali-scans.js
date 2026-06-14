const fs = require("node:fs");
const path = require("node:path");
const { archiveDir } = require("./paths");

const sourceSlug = "wikimedia-bengali-scans";
const retrievedAt = process.env.DATASET_RETRIEVED_AT || new Date().toISOString().slice(0, 10);
const runId = process.env.WIKIMEDIA_BENGALI_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(archiveDir, sourceSlug, runId);
const limit = Number(process.env.WIKIMEDIA_BENGALI_LIMIT || 0);
const delayMs = Number(process.env.WIKIMEDIA_BENGALI_DELAY_MS || 100);
const batchSize = Math.max(1, Math.min(50, Number(process.env.WIKIMEDIA_BENGALI_BATCH_SIZE || 25)));
const commonsBatchSize = Math.max(1, Math.min(50, Number(process.env.WIKIMEDIA_BENGALI_COMMONS_BATCH_SIZE || 25)));
const apiPageLimit = Math.max(25, Math.min(500, Number(process.env.WIKIMEDIA_BENGALI_API_LIMIT || 200)));

const apis = {
  wikisource: "https://bn.wikisource.org/w/api.php",
  commons: "https://commons.wikimedia.org/w/api.php"
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

function unique(values) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function hasBangla(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function banglaDigitsToAscii(value) {
  const digits = {
    "\u09e6": "0",
    "\u09e7": "1",
    "\u09e8": "2",
    "\u09e9": "3",
    "\u09ea": "4",
    "\u09eb": "5",
    "\u09ec": "6",
    "\u09ed": "7",
    "\u09ee": "8",
    "\u09ef": "9"
  };
  return String(value || "").replace(/[\u09e6-\u09ef]/g, (digit) => digits[digit] ?? digit);
}

function numberFromText(value) {
  const match = banglaDigitsToAscii(value).replace(/,/g, "").match(/\b\d+\b/);
  return match ? Number(match[0]) : null;
}

function yearFromText(value) {
  const match = banglaDigitsToAscii(value).match(/(?:^|[^\d])(\d{4})(?:[^\d]|$)/);
  return match ? Number(match[1]) : null;
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
  if (!["bn.wikisource.org", "commons.wikimedia.org"].includes(host)) {
    throw new Error(`Refusing to fetch unexpected host: ${url}`);
  }
  if (parsed.pathname !== "/w/api.php") {
    throw new Error(`Refusing to fetch non-API Wikimedia endpoint: ${url}`);
  }
}

async function fetchJson(apiUrl, params) {
  const url = new URL(apiUrl);
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
      body.set(key, value);
    }
  }
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  body.set("format", "json");
  body.set("formatversion", "2");
  const usePost = url.toString().length > 1800;
  assertAllowedFetch(usePost ? apiUrl : url.toString());

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(usePost ? apiUrl : url, {
        method: usePost ? "POST" : "GET",
        body: usePost ? body : undefined,
        signal: AbortSignal.timeout(Number(process.env.WIKIMEDIA_BENGALI_FETCH_TIMEOUT_MS || 45000)),
        headers: {
          "user-agent":
            "boi-dataset-scrape/1.0 (metadata-only Bengali Wikisource and Commons scan cataloging)",
          accept: "application/json,text/javascript,*/*;q=0.8",
          "accept-language": "bn,en-US;q=0.9,en;q=0.8",
          ...(usePost ? { "content-type": "application/x-www-form-urlencoded" } : {})
        }
      });
      assertAllowedFetch(response.url || url.toString());
      const text = await response.text();
      if (!response.ok) {
        const error = new Error(`Fetch failed ${response.status}: ${url}`);
        if (response.status === 429 || response.status === 503) {
          error.retryAfterMs = Math.max(5000, Number(response.headers.get("retry-after") || 0) * 1000);
        }
        throw error;
      }
      const data = JSON.parse(text);
      if (data.error) throw new Error(`${data.error.code}: ${data.error.info}`);
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(error.retryAfterMs || 1500 * attempt);
    }
  }
  throw lastError;
}

function wikiPageUrl(title, base = "https://bn.wikisource.org/wiki/") {
  return `${base}${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

function indexName(title) {
  return cleanText(String(title || "").replace(/^[^:]+:/u, ""));
}

function isScanIndexTitle(title) {
  const name = indexName(title);
  if (!name) return false;
  if (/\/(?:styles?\.css|common\.css|.+\.(?:css|js))$/i.test(name)) return false;
  return /\.(?:pdf|djvu?|tiff?)$/i.test(name);
}

function fileNameFromIndexTitle(title) {
  const name = indexName(title);
  return cleanText(name?.replace(/^File:/i, ""));
}

function fileTitleFromIndexTitle(title) {
  const fileName = fileNameFromIndexTitle(title);
  return fileName ? `File:${fileName}` : null;
}

function extensionFromFileName(fileName) {
  return cleanText(fileName?.match(/\.([^.]+)$/)?.[1]?.toLowerCase());
}

function stripFileExtension(fileName) {
  return cleanText(String(fileName || "").replace(/\.(?:pdf|djvu?|tiff?)$/i, "").replace(/_/g, " "));
}

function cleanWiki(value) {
  const text = cleanText(value);
  if (!text) return null;
  return cleanText(
    text
      .replace(/<!--.*?-->/gs, " ")
      .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      .replace(/\{\{\s*(?:লেখক|author|লেখক সংযোগ|Creator)\s*\|([^{}|]+)(?:\|[^{}]*)?\}\}/giu, "$1")
      .replace(/\{\{[^{}]*\}\}/g, " ")
      .replace(/'{2,}/g, "")
      .replace(/&nbsp;/gi, " ")
  );
}

function splitPeople(value) {
  const text = cleanWiki(value);
  if (!text) return [];
  return unique(
    text
      .replace(/<br\s*\/?>/gi, ";")
      .split(/\s*(?:;|、| ও | and | & )\s*/iu)
      .filter(Boolean)
  );
}

function parseTemplateFields(wikitext) {
  const fields = {};
  let currentKey = null;
  let currentValue = [];
  const flush = () => {
    if (!currentKey) return;
    fields[currentKey] = cleanText(currentValue.join("\n"));
  };

  for (const line of String(wikitext || "").split(/\r?\n/)) {
    const match = line.match(/^\|\s*([^=]+?)\s*=\s*(.*)$/u);
    if (match) {
      flush();
      currentKey = cleanText(match[1]);
      currentValue = [match[2] || ""];
      continue;
    }
    if (currentKey) currentValue.push(line);
  }
  flush();
  return fields;
}

function fieldValue(fields, names) {
  for (const name of names) {
    const value = fields[name];
    const cleaned = cleanWiki(value);
    if (cleaned) return cleaned;
  }
  return null;
}

function peopleFromFields(fields, names) {
  const people = [];
  for (const name of names) people.push(...splitPeople(fields[name]));
  return unique(people);
}

function parseFileNameMetadata(fileName) {
  const base = stripFileExtension(fileName);
  const publicationYear = yearFromText(base);
  const withoutYear = cleanText(base?.replace(/\s*[\[(（][^\])）]*(?:\d{4}|[০-৯]{4})[^\])）]*[\])）]\s*$/u, ""));
  const pieces = String(withoutYear || base || "")
    .split(/\s+[–—-]\s+/u)
    .map(cleanText)
    .filter(Boolean);

  return {
    title: pieces[0] || withoutYear || base || null,
    contributor: pieces.length > 1 ? pieces[pieces.length - 1] : null,
    publication_year: publicationYear
  };
}

function contributorRows(names, role) {
  return unique(names).map((name) => ({ name, role }));
}

function parseIndexPage(page) {
  const revision = page.revisions?.[0] || {};
  const wikitext = revision.slots?.main?.content || revision.content || "";
  if (/^\s*#redirect\b/i.test(wikitext)) return { skipped: "redirect" };
  if (!isScanIndexTitle(page.title)) return { skipped: "non_scan_index" };

  const fileName = fileNameFromIndexTitle(page.title);
  const fileTitle = fileTitleFromIndexTitle(page.title);
  const fileMeta = parseFileNameMetadata(fileName);
  const fields = parseTemplateFields(wikitext);
  const title = fieldValue(fields, ["Title", "title"]) || fileMeta.title;
  if (!title) return { skipped: "missing_title" };

  const authors = peopleFromFields(fields, ["Author", "Co-author1", "Co-author2", "Co-author3", "Foreword_Author", "Lyricist"]);
  const translators = peopleFromFields(fields, ["Translator", "Co-translator1", "Co-translator2"]);
  const editors = peopleFromFields(fields, ["Editor", "Co-editor1", "Co-editor2"]);
  const filenameAuthor = authors.length ? null : fileMeta.contributor;
  const contributors = [
    ...contributorRows(authors.length ? authors : filenameAuthor ? [filenameAuthor] : [], "author"),
    ...contributorRows(translators, "translator"),
    ...contributorRows(editors, "editor")
  ];
  const publicationYear = yearFromText(fieldValue(fields, ["Year", "year"])) || fileMeta.publication_year || null;

  const titleEn = !hasBangla(title) ? title : null;
  const rawFields = {};
  for (const key of [
    "Type",
    "wikidata_item",
    "Title",
    "Subtitle",
    "Volume",
    "Issue",
    "Edition",
    "Author",
    "Translator",
    "Editor",
    "Publisher",
    "Address",
    "Printer",
    "Year",
    "Source",
    "Progress",
    "Notes"
  ]) {
    if (fields[key]) rawFields[key] = fields[key];
  }

  return {
    row: {
      source: "Bengali Wikisource",
      source_slug: sourceSlug,
      source_id: String(page.pageid),
      url: page.fullurl || wikiPageUrl(page.title),
      retrieved_at: retrievedAt,
      index_title: page.title,
      file_title: fileTitle,
      file_name: fileName,
      file_extension: extensionFromFileName(fileName),
      title,
      ...(titleEn ? { title_en: titleEn } : {}),
      ...(fieldValue(fields, ["Subtitle"]) ? { subtitle: fieldValue(fields, ["Subtitle"]) } : {}),
      ...(contributors.length ? { contributors } : {}),
      ...(contributors.length ? { raw_author: contributors.map((entry) => entry.name).join("; ") } : {}),
      ...(publicationYear ? { publication_year: publicationYear } : {}),
      ...(fieldValue(fields, ["Publisher"]) ? { publishers: [fieldValue(fields, ["Publisher"])] } : {}),
      ...(fieldValue(fields, ["Printer"]) ? { printer: fieldValue(fields, ["Printer"]) } : {}),
      ...(fieldValue(fields, ["Address"]) ? { publication_place: fieldValue(fields, ["Address"]) } : {}),
      wikidata_item: fieldValue(fields, ["wikidata_item"]),
      scan_source: fieldValue(fields, ["Source"]),
      proofread_progress: fieldValue(fields, ["Progress"]),
      language: fieldValue(fields, ["Language"]) || "bn",
      raw_fields: rawFields
    }
  };
}

function extValue(extmetadata, key) {
  return cleanWiki(extmetadata?.[key]?.value);
}

function summarizeCommonsPage(page) {
  const imageInfo = page.imageinfo?.[0] || null;
  const extmetadata = imageInfo?.extmetadata || {};
  return {
    file_title: page.title,
    commons_pageid: page.pageid ? String(page.pageid) : null,
    commons_page_url: page.fullurl || wikiPageUrl(page.title, "https://commons.wikimedia.org/wiki/"),
    mime: imageInfo?.mime || null,
    media_type: imageInfo?.mediatype || null,
    size_bytes: imageInfo?.size || null,
    width: imageInfo?.width || null,
    height: imageInfo?.height || null,
    page_count: imageInfo?.pagecount || null,
    license_short_name: extValue(extmetadata, "LicenseShortName"),
    usage_terms: extValue(extmetadata, "UsageTerms"),
    artist: extValue(extmetadata, "Artist"),
    categories: extValue(extmetadata, "Categories")
  };
}

function mergeCommons(row, commons) {
  if (!commons) {
    return {
      ...row,
      commons_page_url: row.file_title ? wikiPageUrl(row.file_title, "https://commons.wikimedia.org/wiki/") : null
    };
  }
  return {
    ...row,
    commons_pageid: commons.commons_pageid,
    commons_page_url: commons.commons_page_url,
    mime: commons.mime,
    media_type: commons.media_type,
    size_bytes: commons.size_bytes,
    width: commons.width,
    height: commons.height,
    page_count: commons.page_count,
    license_short_name: commons.license_short_name,
    usage_terms: commons.usage_terms,
    commons_artist: commons.artist,
    commons_categories: commons.categories
  };
}

async function collectIndexPages() {
  const cachePath = path.join(runDir, "wikisource-index-pages.jsonl");
  if (!limit && fs.existsSync(cachePath)) {
    const cached = fs
      .readFileSync(cachePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    if (cached.length) return cached;
  }

  const pages = [];
  let apcontinue = null;
  do {
    const data = await fetchJson(apis.wikisource, {
      action: "query",
      list: "allpages",
      apnamespace: "102",
      aplimit: String(apiPageLimit),
      apfilterredir: "nonredirects",
      apcontinue
    });
    pages.push(...(data.query?.allpages || []).filter((page) => isScanIndexTitle(page.title)));
    if (limit && pages.length >= limit) return pages.slice(0, limit);
    apcontinue = data.continue?.apcontinue || null;
    if (delayMs) await sleep(delayMs);
  } while (apcontinue);
  return pages;
}

async function fetchIndexDetails(pages) {
  const selected = limit ? pages.slice(0, limit) : pages;
  const recordsPath = path.join(runDir, "wikisource-index-records.jsonl");
  const skippedPath = path.join(runDir, "skipped-index-pages.jsonl");
  const records = readJsonl(recordsPath);
  const skipped = readJsonl(skippedPath);
  const seenPageIds = new Set([...records.map((row) => row.source_id), ...skipped.map((row) => String(row.pageid || ""))].filter(Boolean));
  const queue = selected.filter((page) => !seenPageIds.has(String(page.pageid)));

  for (let index = 0; index < queue.length; index += batchSize) {
    const batch = queue.slice(index, index + batchSize);
    const data = await fetchJson(apis.wikisource, {
      action: "query",
      prop: "revisions|info",
      rvprop: "content|timestamp|ids",
      rvslots: "main",
      inprop: "url",
      pageids: batch.map((page) => page.pageid).join("|")
    });
    for (const page of data.query?.pages || []) {
      const parsed = parseIndexPage(page);
      if (parsed.row) {
        records.push(parsed.row);
        appendJsonl(recordsPath, parsed.row);
      } else {
        const row = { pageid: page.pageid, title: page.title, reason: parsed.skipped || "unknown" };
        skipped.push(row);
        appendJsonl(skippedPath, row);
      }
    }
    console.log(
      `[wikimedia-bengali] index ${Math.min(index + batch.length, queue.length)}/${queue.length} remaining (${records.length} records total)`
    );
    if (delayMs) await sleep(delayMs);
  }
  return { records, skipped };
}

function fileKey(value) {
  return cleanText(value)?.toLowerCase().replace(/_/g, " ");
}

async function fetchCommonsFiles(fileTitles) {
  const filePath = path.join(runDir, "commons-files.jsonl");
  const rows = readJsonl(filePath);
  const seenTitles = new Set(rows.map((row) => fileKey(row.file_title)).filter(Boolean));
  const queue = fileTitles.filter((title) => !seenTitles.has(fileKey(title)));

  for (let index = 0; index < queue.length; index += commonsBatchSize) {
    const batch = queue.slice(index, index + commonsBatchSize);
    const data = await fetchJson(apis.commons, {
      action: "query",
      prop: "imageinfo|info",
      iiprop: "size|mime|mediatype|extmetadata",
      inprop: "url",
      redirects: "1",
      titles: batch.join("|")
    });
    for (const page of data.query?.pages || []) {
      let row;
      if (page.missing) {
        row = {
          file_title: page.title,
          commons_pageid: null,
          commons_page_url: wikiPageUrl(page.title, "https://commons.wikimedia.org/wiki/"),
          missing: true
        };
      } else {
        row = summarizeCommonsPage(page);
      }
      rows.push(row);
      appendJsonl(filePath, row);
    }
    console.log(
      `[wikimedia-bengali] commons ${Math.min(index + batch.length, queue.length)}/${queue.length} remaining (${rows.length} records total)`
    );
    if (delayMs) await sleep(delayMs);
  }
  return rows;
}

async function main() {
  ensureDir(runDir);
  const errors = [];
  const allIndexPages = await collectIndexPages();
  writeJsonl(path.join(runDir, "wikisource-index-pages.jsonl"), allIndexPages);

  const { records, skipped } = await fetchIndexDetails(allIndexPages);
  const fileTitles = unique(records.map((row) => row.file_title));
  const commonsRows = await fetchCommonsFiles(fileTitles);
  const commonsByTitle = new Map(commonsRows.map((row) => [fileKey(row.file_title), row]));
  const books = records.map((row) => mergeCommons(row, commonsByTitle.get(fileKey(row.file_title))));

  writeJsonl(path.join(runDir, "books.jsonl"), books);
  writeJsonl(path.join(runDir, "errors.jsonl"), errors);
  writeJson(path.join(runDir, "manifest.json"), {
    source: "Bengali Wikisource + Wikimedia Commons",
    source_slug: sourceSlug,
    run_id: runId,
    retrieved_at: retrievedAt,
    generated_at: new Date().toISOString(),
    notes:
      "Metadata-only Wikimedia scrape. The scraper reads Bengali Wikisource Index namespace API records and Commons file-page metadata through w/api.php only; it does not request direct file URLs or download scan files.",
    wikisource_index_namespace: 102,
    wikisource_index_pages: allIndexPages.length,
    records: books.length,
    commons_files: commonsRows.length,
    skipped_index_pages: skipped.length,
    errors: errors.length,
    files: {
      books: `${sourceSlug}/${runId}/books.jsonl`,
      wikisource_index_pages: `${sourceSlug}/${runId}/wikisource-index-pages.jsonl`,
      commons_files: `${sourceSlug}/${runId}/commons-files.jsonl`
    }
  });

  console.log(
    JSON.stringify(
      {
        run_id: runId,
        wikisource_index_pages: allIndexPages.length,
        records: books.length,
        commons_files: commonsRows.length,
        skipped_index_pages: skipped.length,
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
