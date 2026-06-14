const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const cheerio = require("cheerio");
const { archiveDir, tables: paths } = require("./paths");

const sourceName = "BDeBooks";
const baseUrl = "https://bdebooks.com";
const retrievedAt = process.env.DATASET_RETRIEVED_AT || new Date().toISOString().slice(0, 10);
const runId = process.env.BDEBOOKS_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(archiveDir, "bdebooks", runId);
const limit = Number(process.env.BDEBOOKS_LIMIT || 0);
const importEnabled = process.env.BDEBOOKS_IMPORT === "1";
const pageSize = Math.min(100, Math.max(1, Number(process.env.BDEBOOKS_PAGE_SIZE || 100)));
const delayMs = Number(process.env.BDEBOOKS_DELAY_MS || 200);
const sitemapLimit = Number(process.env.BDEBOOKS_SITEMAP_LIMIT || 0);

const endpoints = {
  robots: `${baseUrl}/robots.txt`,
  sitemapIndex: `${baseUrl}/sitemap_index.xml`,
  books: `${baseUrl}/wp-json/wp/v2/books`,
  authors: `${baseUrl}/wp-json/wp/v2/ep-author`,
  genres: `${baseUrl}/wp-json/wp/v2/ep-genres`,
  series: `${baseUrl}/wp-json/wp/v2/ep-series`
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function hash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 14);
}

function makeId(prefix, value) {
  return `${prefix}_${hash(value || prefix)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

function textFromRendered(value) {
  const text = cleanText(value);
  if (!text) return null;
  return cleanText(cheerio.load(`<span>${text}</span>`).text());
}

function hasBangla(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function key(value) {
  return cleanText(value)
    ?.toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
    .trim();
}

function splitMixedName(value) {
  const text = cleanText(value);
  if (!text) return { bn: null, en: null };
  return hasBangla(text) ? { bn: text, en: null } : { bn: null, en: text };
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

function assertAllowedFetch(url) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  if (host === "dl.bdebooks.com" || host.endsWith(".dl.bdebooks.com") || parsed.pathname.startsWith("/dl/")) {
    throw new Error(`Refusing to fetch BDeBooks download endpoint: ${url}`);
  }
}

async function fetchText(url, options = {}) {
  assertAllowedFetch(url);
  const { accept, headers, ...fetchOptions } = options;
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          accept: accept || "application/json,text/xml,text/plain,*/*",
          "accept-language": "en-US,en;q=0.9,bn;q=0.8",
          "cache-control": "no-cache",
          ...(headers || {})
        }
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
      return {
        text,
        status: response.status,
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

function withParams(url, params) {
  const parsed = new URL(url);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) parsed.searchParams.set(name, String(value));
  }
  return parsed.toString();
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

    writeJson(path.join(rawDir, `${String(page).padStart(4, "0")}.json`), data);
    rows.push(...data);
    console.log(`${name}: page ${page}/${totalPages}, rows ${rows.length}${total ? `/${total}` : ""}`);

    if (maxRows && rows.length >= maxRows) return rows.slice(0, maxRows);
    if (page < totalPages) await sleep(delayMs);
  }

  return rows;
}

function parseSitemapIndex(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("sitemap")
    .map((_, node) => ({
      loc: cleanText($(node).find("loc").first().text()),
      lastmod: cleanText($(node).find("lastmod").first().text())
    }))
    .get()
    .filter((entry) => entry.loc);
}

function parseBookSitemap(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("url")
    .map((_, node) => ({
      loc: cleanText($(node).find("loc").first().text()),
      lastmod: cleanText($(node).find("lastmod").first().text()),
      image: cleanText($(node).find("image\\:loc").first().text())
    }))
    .get()
    .filter((entry) => entry.loc && /\/books\//i.test(entry.loc));
}

async function fetchSitemaps() {
  const robots = await fetchText(endpoints.robots, { accept: "text/plain,*/*" });
  writeText(path.join(runDir, "robots.txt"), robots.text);

  const sitemapIndex = await fetchText(endpoints.sitemapIndex, { accept: "text/xml,*/*" });
  writeText(path.join(runDir, "sitemap_index.xml"), sitemapIndex.text);

  const sitemapEntries = parseSitemapIndex(sitemapIndex.text);
  const bookSitemapUrls = sitemapEntries
    .map((entry) => entry.loc)
    .filter((loc) => /\/book-sitemap\d+\.xml$/i.test(loc))
    .slice(0, sitemapLimit || undefined);

  const books = [];
  for (const sitemapUrl of bookSitemapUrls) {
    const fileName = path.basename(new URL(sitemapUrl).pathname);
    const response = await fetchText(sitemapUrl, { accept: "text/xml,*/*" });
    writeText(path.join(runDir, "sitemaps", fileName), response.text);
    const parsed = parseBookSitemap(response.text);
    books.push(...parsed);
    console.log(`sitemap: ${fileName}, book URLs ${parsed.length}`);
    await sleep(delayMs);
  }

  writeJson(path.join(runDir, "sitemap-list.json"), sitemapEntries);
  writeJsonl(path.join(runDir, "sitemap-books.jsonl"), books);
  return books;
}

function buildTermMap(terms) {
  const map = new Map();
  for (const term of terms) {
    const name = textFromRendered(term.name);
    map.set(Number(term.id), {
      id: Number(term.id),
      name,
      slug: cleanText(term.slug),
      url: cleanText(term.link),
      count: Number(term.count || 0),
      description: cleanText(term.description),
      taxonomy: cleanText(term.taxonomy),
      parent: Number(term.parent || 0)
    });
  }
  return map;
}

function termsFromIds(ids, termMap) {
  return (Array.isArray(ids) ? ids : [])
    .map((id) => termMap.get(Number(id)))
    .filter(Boolean)
    .map((term) => ({
      id: term.id,
      name: term.name,
      slug: term.slug,
      url: term.url
    }));
}

function isPlaceholderAuthor(term) {
  const name = key(term?.name);
  const slug = key(term?.slug);
  const description = key(term?.description);
  return name === "bdebooks" || slug === "bdebooks pdf" || /placeholder/.test(description || "");
}

function titleCaseSlug(slug) {
  return cleanText(
    String(slug || "")
      .split("-")
      .filter(Boolean)
      .map((part) => (/^\d+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
      .join(" ")
  );
}

function splitTitleAuthorFromText(title) {
  const text = cleanText(title);
  if (!text) return { title: null, author: null };
  const match = text.match(/^(.{2,180})\s+by\s+(.{2,140})$/i);
  if (!match) return { title: text, author: null };
  const author = cleanText(match[2]);
  if (!author || /^bdebooks(?:\s+pdf)?$/i.test(author)) return { title: cleanText(match[1]), author: null };
  return { title: cleanText(match[1]), author };
}

function splitTitleAuthorFromSlug(book) {
  const rawSlug = cleanText(book.slug) || new URL(book.link).pathname.split("/").filter(Boolean).pop();
  const slug = String(rawSlug || "").replace(/-by-bdebooks_pdf$/i, "");
  const index = slug.lastIndexOf("-by-");
  if (index < 3) return { title: null, author: null };
  return {
    title: titleCaseSlug(slug.slice(0, index)),
    author: titleCaseSlug(slug.slice(index + 4))
  };
}

function stripAuthorSuffix(title, authors) {
  let cleaned = cleanText(title);
  if (!cleaned) return null;

  for (const author of authors) {
    const authorKey = key(author.name);
    const parsed = splitTitleAuthorFromText(cleaned);
    if (parsed.author && key(parsed.author) === authorKey) {
      cleaned = parsed.title;
    }
  }

  return cleaned;
}

function normalizeBook(book, termMaps, sitemapByUrl) {
  const rawTitle = textFromRendered(book.title?.rendered || book.title);
  const originalAuthors = termsFromIds(book["ep-author"], termMaps.authors);
  const placeholderAuthors = originalAuthors.filter(isPlaceholderAuthor);
  let authors = originalAuthors.filter((author) => !isPlaceholderAuthor(author));
  let title = stripAuthorSuffix(rawTitle, authors);
  let derivedAuthor = null;

  if (!authors.length) {
    const fromTitle = splitTitleAuthorFromText(rawTitle);
    title = fromTitle.title || title || rawTitle;
    derivedAuthor = fromTitle.author;

    if (!derivedAuthor) {
      const fromSlug = splitTitleAuthorFromSlug(book);
      title = title || fromSlug.title || rawTitle;
      derivedAuthor = fromSlug.author;
    }

    if (derivedAuthor) {
      authors = [
        {
          id: null,
          name: derivedAuthor,
          slug: key(derivedAuthor)?.replace(/\s+/g, "-") || null,
          url: null,
          derived_from: "title_or_slug"
        }
      ];
      title = stripAuthorSuffix(title, authors);
    }
  }

  const sitemap = sitemapByUrl.get(cleanText(book.link));
  const genres = termsFromIds(book["ep-genres"], termMaps.genres);
  const series = termsFromIds(book["ep-series"], termMaps.series);

  return {
    source: sourceName,
    source_id: String(book.id),
    slug: cleanText(book.slug),
    url: cleanText(book.link),
    title: title || rawTitle,
    raw_title: rawTitle,
    authors,
    genres,
    series,
    post_date: cleanText(book.date),
    modified: cleanText(book.modified),
    sitemap_lastmod: sitemap?.lastmod || null,
    cover_url: sitemap?.image || null,
    retrieved_at: retrievedAt,
    wp: {
      author_ids: Array.isArray(book["ep-author"]) ? book["ep-author"] : [],
      genre_ids: Array.isArray(book["ep-genres"]) ? book["ep-genres"] : [],
      series_ids: Array.isArray(book["ep-series"]) ? book["ep-series"] : []
    },
    flags: {
      placeholder_author_seen: placeholderAuthors.length > 0,
      author_derived_from_title_or_slug: Boolean(derivedAuthor),
      no_usable_author: authors.length === 0
    }
  };
}

function mergeById(existingRows, importedRows) {
  const map = new Map(existingRows.map((row) => [row.id, row]));
  for (const row of importedRows) {
    const previous = map.get(row.id);
    if (!previous) {
      map.set(row.id, row);
      continue;
    }

    const merged = { ...previous };
    for (const [field, value] of Object.entries(row)) {
      if (value !== null && value !== undefined) merged[field] = value;
    }
    map.set(row.id, {
      ...merged,
      aliases: Array.from(new Set([...(previous.aliases || []), ...(row.aliases || [])].filter(Boolean))),
      source_refs: Array.from(new Set([...(previous.source_refs || []), ...(row.source_refs || [])]))
    });
  }
  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function addLookup(map, lookupKey, id) {
  if (lookupKey && id && !map.has(lookupKey)) map.set(lookupKey, id);
}

function buildImportMaps() {
  const maps = {
    sources: new Map(),
    authors: new Map(),
    works: new Map(),
    editions: new Map(),
    contributions: new Map(),
    authorKeyToId: new Map(),
    workKeyToId: new Map()
  };

  for (const author of readJsonl(paths.authors)) {
    for (const name of [author.name_bn, author.name_en, ...(author.aliases || [])]) {
      addLookup(maps.authorKeyToId, key(name), author.id);
    }
  }

  const authorIdsByWork = new Map();
  for (const contribution of readJsonl(paths.contributions)) {
    if (!contribution.work_id || !contribution.author_id) continue;
    const ids = authorIdsByWork.get(contribution.work_id) || [];
    ids.push(contribution.author_id);
    authorIdsByWork.set(contribution.work_id, ids);
  }

  for (const work of readJsonl(paths.works)) {
    const authorIds = authorIdsByWork.get(work.id) || [""];
    const titles = [work.title_bn, work.title_en, ...(work.aliases || [])].filter(Boolean);
    for (const title of titles) {
      for (const authorId of authorIds) {
        addLookup(maps.workKeyToId, key(`${title}|${authorId}`), work.id);
      }
    }
  }

  return maps;
}

function addSource(maps, source) {
  maps.sources.set(source.id, source);
  return source.id;
}

function addAuthor(maps, input) {
  const nameKey = key(input.name_bn || input.name_en || input.id);
  const id = (nameKey && maps.authorKeyToId.get(nameKey)) || input.id || makeId("author", `${input.name_bn || ""}|${input.name_en || ""}`);
  if (nameKey) maps.authorKeyToId.set(nameKey, id);
  const previous = maps.authors.get(id);
  maps.authors.set(id, {
    id,
    name_bn: input.name_bn ?? previous?.name_bn ?? null,
    name_en: input.name_en ?? previous?.name_en ?? null,
    aliases: Array.from(new Set([...(previous?.aliases || []), ...(input.aliases || [])].filter(Boolean))),
    birth_year: input.birth_year ?? previous?.birth_year ?? null,
    death_year: input.death_year ?? previous?.death_year ?? null,
    country_or_region: input.country_or_region ?? previous?.country_or_region ?? null,
    notes: input.notes ?? previous?.notes ?? null,
    source_refs: Array.from(new Set([...(previous?.source_refs || []), ...(input.source_refs || [])])),
    confidence: Math.max(previous?.confidence || 0, input.confidence || 0.72)
  });
  return id;
}

function addWork(maps, input) {
  const workKey = key(`${input.title_bn || input.title_en}|${input.author_id || ""}`);
  const id = (workKey && maps.workKeyToId.get(workKey)) || input.id || makeId("work", `${input.title_bn || ""}|${input.title_en || ""}|${input.author_id || ""}`);
  if (workKey) maps.workKeyToId.set(workKey, id);
  const previous = maps.works.get(id);
  maps.works.set(id, {
    id,
    title_bn: input.title_bn ?? previous?.title_bn ?? null,
    title_en: input.title_en ?? previous?.title_en ?? null,
    aliases: Array.from(new Set([...(previous?.aliases || []), ...(input.aliases || [])].filter(Boolean))),
    language: input.language || previous?.language || "bn",
    genre: input.genre ?? previous?.genre ?? null,
    first_published_year: input.first_published_year ?? previous?.first_published_year ?? null,
    source_refs: Array.from(new Set([...(previous?.source_refs || []), ...(input.source_refs || [])])),
    confidence: Math.max(previous?.confidence || 0, input.confidence || 0.72)
  });
  return id;
}

function addEdition(maps, input) {
  const id = input.id || makeId("edition", `${input.work_id}|${input.source_refs?.join("|")}|${input.title_as_printed}`);
  const previous = maps.editions.get(id);
  maps.editions.set(id, {
    id,
    work_id: input.work_id,
    title_as_printed: input.title_as_printed,
    publisher: input.publisher ?? previous?.publisher ?? null,
    publication_year: input.publication_year ?? previous?.publication_year ?? null,
    isbn: input.isbn ?? previous?.isbn ?? null,
    pages: input.pages ?? previous?.pages ?? null,
    format: input.format ?? previous?.format ?? null,
    source_refs: Array.from(new Set([...(previous?.source_refs || []), ...(input.source_refs || [])])),
    confidence: Math.max(previous?.confidence || 0, input.confidence || 0.72)
  });
  return id;
}

function addContribution(maps, input) {
  if (!input.author_id) return null;
  const id = input.id || makeId("contrib", `${input.work_id}|${input.edition_id || ""}|${input.author_id}|${input.role || "author"}`);
  const previous = maps.contributions.get(id);
  maps.contributions.set(id, {
    id,
    work_id: input.work_id,
    edition_id: input.edition_id ?? previous?.edition_id ?? null,
    author_id: input.author_id,
    role: input.role || previous?.role || "author",
    source_refs: Array.from(new Set([...(previous?.source_refs || []), ...(input.source_refs || [])])),
    confidence: Math.max(previous?.confidence || 0, input.confidence || 0.72)
  });
  return id;
}

function sourceNotes(record) {
  const pieces = ["BDeBooks WordPress catalog metadata scrape; no book files downloaded"];
  if (record.genres.length) pieces.push(`genres: ${record.genres.map((genre) => genre.name).join("; ")}`);
  if (record.series.length) pieces.push(`series: ${record.series.map((series) => series.name).join("; ")}`);
  if (record.sitemap_lastmod) pieces.push(`sitemap_lastmod: ${record.sitemap_lastmod}`);
  if (record.flags.placeholder_author_seen) pieces.push("BDeBooks placeholder author taxonomy ignored");
  if (record.flags.author_derived_from_title_or_slug) pieces.push("author derived from title or URL slug because source taxonomy used a placeholder");
  return pieces.join(". ");
}

function importBooks(records, rawPath) {
  const maps = buildImportMaps();

  for (const record of records) {
    const sourceId = addSource(maps, {
      id: `source_bdebooks_wp_${record.source_id}`,
      source: sourceName,
      url: record.url,
      retrieved_at: retrievedAt,
      raw_path: rawPath,
      external_id: record.source_id,
      record_type: "book",
      raw_title: record.raw_title,
      raw_author: record.authors.map((author) => author.name).join("; ") || null,
      notes: sourceNotes(record)
    });

    const authorIds = [];
    for (const author of record.authors) {
      const split = splitMixedName(author.name);
      authorIds.push(
        addAuthor(maps, {
          name_bn: split.bn,
          name_en: split.en,
          aliases: author.derived_from ? [] : [author.slug].filter(Boolean),
          notes: author.derived_from ? "Name derived from BDeBooks title or URL slug because the taxonomy author was a placeholder." : null,
          source_refs: [sourceId],
          confidence: author.derived_from ? 0.66 : 0.74
        })
      );
    }

    const splitTitle = splitMixedName(record.title);
    const aliases = [];
    if (record.raw_title && record.raw_title !== record.title) aliases.push(record.raw_title);
    const primaryAuthorId = authorIds[0] || null;
    const workId = addWork(maps, {
      title_bn: splitTitle.bn,
      title_en: splitTitle.en,
      aliases,
      language: "bn",
      genre: record.genres[0]?.name || null,
      first_published_year: null,
      author_id: primaryAuthorId,
      source_refs: [sourceId],
      confidence: primaryAuthorId ? 0.74 : 0.64
    });

    const editionId = addEdition(maps, {
      id: `edition_bdebooks_wp_${record.source_id}`,
      work_id: workId,
      title_as_printed: record.title,
      publisher: null,
      publication_year: null,
      isbn: null,
      pages: null,
      format: "ebook catalog entry",
      source_refs: [sourceId],
      confidence: primaryAuthorId ? 0.72 : 0.62
    });

    for (const authorId of authorIds) {
      addContribution(maps, {
        work_id: workId,
        edition_id: editionId,
        author_id: authorId,
        role: "author",
        source_refs: [sourceId],
        confidence: 0.72
      });
    }
  }

  const imported = {
    sources: Array.from(maps.sources.values()),
    authors: Array.from(maps.authors.values()).filter((row) => row.name_bn || row.name_en),
    works: Array.from(maps.works.values()).filter((row) => row.title_bn || row.title_en),
    editions: Array.from(maps.editions.values()),
    contributions: Array.from(maps.contributions.values())
  };

  const mergedSources = mergeById(readJsonl(paths.sources), imported.sources);
  const mergedAuthors = mergeById(readJsonl(paths.authors), imported.authors);
  const mergedWorks = mergeById(readJsonl(paths.works), imported.works);
  const mergedEditions = mergeById(readJsonl(paths.editions), imported.editions);
  const mergedContributions = mergeById(readJsonl(paths.contributions), imported.contributions);

  writeJsonl(paths.sources, mergedSources);
  writeJsonl(paths.authors, mergedAuthors);
  writeJsonl(paths.works, mergedWorks);
  writeJsonl(paths.editions, mergedEditions);
  writeJsonl(paths.contributions, mergedContributions);

  return {
    source_records: imported.sources.length,
    authors: imported.authors.length,
    works: imported.works.length,
    editions: imported.editions.length,
    contributions: imported.contributions.length
  };
}

async function main() {
  ensureDir(runDir);

  const sitemapBooks = await fetchSitemaps();
  const sitemapByUrl = new Map(sitemapBooks.map((entry) => [entry.loc, entry]));

  const [authorTerms, genreTerms, seriesTerms] = await Promise.all([
    fetchCollection({
      name: "authors",
      url: endpoints.authors,
      fields: "id,count,description,link,name,slug,taxonomy,parent"
    }),
    fetchCollection({
      name: "genres",
      url: endpoints.genres,
      fields: "id,count,description,link,name,slug,taxonomy,parent"
    }),
    fetchCollection({
      name: "series",
      url: endpoints.series,
      fields: "id,count,description,link,name,slug,taxonomy,parent"
    })
  ]);

  const books = await fetchCollection({
    name: "books",
    url: endpoints.books,
    fields: "id,slug,link,title,date,modified,ep-author,ep-series,ep-genres",
    maxRows: limit
  });

  const termMaps = {
    authors: buildTermMap(authorTerms),
    genres: buildTermMap(genreTerms),
    series: buildTermMap(seriesTerms)
  };

  const records = books.map((book) => normalizeBook(book, termMaps, sitemapByUrl));
  const rawPath = `archive/bdebooks/${runId}/books.jsonl`;
  writeJsonl(path.join(runDir, "books.jsonl"), records);

  const imported = importEnabled ? importBooks(records, rawPath) : null;
  const manifest = {
    source: sourceName,
    retrieved_at: retrievedAt,
    run_id: runId,
    base_url: baseUrl,
    robots: {
      url: endpoints.robots,
      disallowed_download_path: "/dl/",
      download_host_blocked_by_scraper: "dl.bdebooks.com"
    },
    endpoints,
    config: {
      limit: limit || null,
      page_size: pageSize,
      delay_ms: delayMs,
      sitemap_limit: sitemapLimit || null,
      import_enabled: importEnabled
    },
    counts: {
      sitemap_book_urls: sitemapBooks.length,
      author_terms: authorTerms.length,
      genre_terms: genreTerms.length,
      series_terms: seriesTerms.length,
      books: records.length,
      placeholder_author_records: records.filter((record) => record.flags.placeholder_author_seen).length,
      derived_author_records: records.filter((record) => record.flags.author_derived_from_title_or_slug).length,
      no_usable_author_records: records.filter((record) => record.flags.no_usable_author).length,
      imported
    },
    files: {
      books: rawPath,
      sitemap_books: `archive/bdebooks/${runId}/sitemap-books.jsonl`,
      manifest: `archive/bdebooks/${runId}/manifest.json`
    }
  };

  writeJson(path.join(runDir, "manifest.json"), manifest);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
