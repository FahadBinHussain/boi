const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { archiveDir, mainDir, tables: paths } = require("./paths");
const { readJsonl, writeJsonl } = require("./jsonl-store");

const root = path.resolve(__dirname, "..");
const normalizedDir = mainDir;
const rawDir = archiveDir;
const retrievedAt = process.env.DATASET_RETRIEVED_AT || new Date().toISOString().slice(0, 10);
const resetMain = process.env.RESET_DATASET_MAIN === "1" || process.env.RESET_DATASET_NORMALIZED === "1";

const config = {
  rokomariLimit: Number(process.env.ROKOMARI_LIMIT || 2500),
  rokomariBytes: Number(process.env.ROKOMARI_BYTES || 120_000_000),
  openLibraryLimit: Number(process.env.OPENLIBRARY_LIMIT || 1000),
  internetArchiveLimit: Number(process.env.IA_LIMIT || 800),
  wikidataLimit: Number(process.env.WIKIDATA_LIMIT || 500),
  authorsComBdAuthorLimit: Number(process.env.AUTHORS_COM_BD_AUTHOR_LIMIT || 8),
  authorsComBdAuthorBookPageLimit: Number(process.env.AUTHORS_COM_BD_AUTHOR_BOOK_PAGE_LIMIT || 5),
  booksComBdListPageLimit: Number(process.env.BOOKS_COM_BD_LIST_PAGE_LIMIT || 2)
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function hash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 14);
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function yearFrom(value) {
  if (!value) return null;
  const match = String(value).match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}

function hasBangla(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function isRokomariBookPage(url) {
  return /^https?:\/\/www\.rokomari\.com\/book\/\d+\//i.test(String(url || ""));
}

function isRokomariPlaceholderBook(book) {
  const title = cleanText(book?.book_title);
  return !title || title.toLowerCase() === "book" || !isRokomariBookPage(book?.book_url);
}

function splitMixedName(value) {
  const text = cleanText(value);
  if (!text) return { bn: null, en: null };
  const pipeParts = text.split(/\s*\|\s*/).map(cleanText).filter(Boolean);
  if (pipeParts.length > 1) {
    const bn = pipeParts.find((part) => hasBangla(part)) || null;
    const en = pipeParts.find((part) => /[A-Za-z]/.test(part) && !hasBangla(part)) || null;
    if (bn || en) return { bn, en };
  }
  const firstBangla = text.search(/[\u0980-\u09FF]/);
  if (firstBangla > 0) {
    return {
      en: cleanText(text.slice(0, firstBangla)),
      bn: cleanText(text.slice(firstBangla))
    };
  }
  return hasBangla(text) ? { bn: text, en: null } : { bn: null, en: text };
}

const colonAbbreviationTokens = new Set(["ড", "ডা", "মো", "মো", "মোঃ", "মোঃ", "ইঞ্জি", "অব", "mr", "mrs", "ms", "dr"]);
const numericPartPattern = /^\p{Decimal_Number}+(?:[.,٫]\p{Decimal_Number}+)?(?:\s*(?:শ|তম|ম|য়|য়|র্থ|ষ্ঠ|st|nd|rd|th))?(?:\s*(?:খণ্ড|খন্ড|part))?$/iu;

function isRokomariNonAuthor(value) {
  const text = cleanText(value)?.replace(/^[-–—\s]+|[-–—\s]+$/gu, "");
  if (!text) return true;
  if (/^\p{Decimal_Number}+(?:[.,٫]\p{Decimal_Number}+)?\s*[:：]/u.test(text)) return true;
  if (numericPartPattern.test(text)) return true;
  return /(?:খণ্ড|খন্ড|\bpart\b)/iu.test(text);
}

function isSourceLikeNonAuthor(value) {
  const text = cleanText(value)?.replace(/^[-–—\s]+|[-–—\s]+$/gu, "");
  if (!text) return true;
  if (/^(?:creator|editor|anonymous|unknown(?:\s*\d+)?|not available|n\/a|na|none|null)$/i.test(text)) return true;
  if (/(?:https?:\/\/|www\.|@)/i.test(text)) return true;
  if (/(?:^|[\s/])[\p{Letter}\p{Number}-]+(?:\.[\p{Letter}\p{Number}-]+)+(?:[\s/:?#]|$)/iu.test(text)) {
    return true;
  }
  return /\b(?:archive|blogspot|collection|educarion|education|genid|internet archive|scanner|school|unmochon|uploaded by|uploader|weebly|wikidata\.org|wordpress)\b|(?:শিক্ষা\s*পরিবার)/iu.test(text);
}

function isUsableAuthorName(value) {
  return !isRokomariNonAuthor(value) && !isSourceLikeNonAuthor(value);
}

function archivePackagingSignal(value) {
  const text = cleanText(value);
  if (!text) return false;
  if (/^\p{Decimal_Number}+[.)।]*$/u.test(text)) return true;
  if (/\p{Decimal_Number}{1,2}[./-]\p{Decimal_Number}{1,2}[./-]\p{Decimal_Number}{2,4}/u.test(text)) return true;
  return /\.(?:pdf|epub|mobi)\b|(?:বইঃ|ডাউনলোড|নন-প্রফিট|পিডিএফ|প্রকাশকঃ|লেখক\s*\/\s*অনুবাদক|শিক্ষা\s*পরিবার)|\b(?:compressed|download|educarion|education|high[-\s]?quality|media|pdf|school|team|unmochon)\b/iu.test(text);
}

function stripBanglaGenitive(value) {
  return cleanText(value)?.replace(/(?:ের|এর)$/u, "") || null;
}

function normalizeKnownBanglaAuthorName(value) {
  const text = cleanText(value);
  if (!text) return null;
  if (/হুমা[য়য়]ুন\s+আহমেদ/u.test(text)) return "হুমায়ূন আহমেদ";
  return text;
}

function parseInternetArchiveDescription(description) {
  const text = cleanText(description);
  if (!text || !hasBangla(text)) return null;
  const match = text.match(/^(.{3,80}?)(?:ের|এর)\s+(.{2,100}?)[।.!?]*$/u);
  if (!match) return null;
  const author = normalizeKnownBanglaAuthorName(stripBanglaGenitive(match[1]));
  const title = cleanText(match[2]);
  if (!author || !title || !hasBangla(author) || !hasBangla(title)) return null;
  return { author, title };
}

function normalizeInternetArchiveDoc(doc) {
  const rawTitle = cleanText(doc.title);
  const rawCreators = Array.isArray(doc.creator) ? doc.creator : doc.creator ? [doc.creator] : [];
  const descriptionClaim = parseInternetArchiveDescription(doc.description);
  const sourceishCreator = rawCreators.some((creator) => isSourceLikeNonAuthor(creator) || archivePackagingSignal(creator));
  const packagedTitle = archivePackagingSignal(rawTitle);

  if (descriptionClaim && (packagedTitle || sourceishCreator || rawTitle?.includes(descriptionClaim.title))) {
    return {
      title: descriptionClaim.title,
      creators: [descriptionClaim.author],
      publicationYear: null,
      cleanedFromDescription: true
    };
  }

  return {
    title: rawTitle,
    creators: rawCreators.filter((creator) => isUsableAuthorName(creator)),
    publicationYear: yearFrom(doc.date),
    cleanedFromDescription: false
  };
}

function tokenBeforeColon(value) {
  const token = cleanText(value)
    ?.split(/\s+/)
    .pop()
    ?.replace(/[^\p{Letter}\p{Mark}\p{Number}ঃ]+/gu, "")
    .toLowerCase();
  return token || null;
}

function cleanRokomariPageAuthor(value) {
  const text = cleanText(value);
  if (!text) return null;
  return cleanText(text.replace(/\s*-\s*\([^)]{1,80}\)\s*$/u, ""));
}

function preferBanglaSide(value) {
  const text = cleanText(value);
  if (!text) return null;
  const parts = text.split(/\s+-\s+/);
  if (parts.length > 1 && hasBangla(parts[0]) && /[A-Za-z]/.test(parts.slice(1).join(" - "))) {
    return cleanText(parts[0]);
  }
  return text;
}

function splitRokomariTitleAuthor(value) {
  const text = preferBanglaSide(value);
  if (!text) return { titleSuffix: null, author: null };

  let candidate = null;
  for (const match of text.matchAll(/[:：]/gu)) {
    const before = cleanText(text.slice(0, match.index));
    const after = cleanText(text.slice(match.index + match[0].length));
    if (!before || !after) continue;

    const token = tokenBeforeColon(before);
    if (token && colonAbbreviationTokens.has(token)) continue;
    if (before.length <= 4 && !numericPartPattern.test(before) && !/[)’”'\]]$/u.test(before)) continue;

    candidate = {
      titleSuffix: before,
      author: cleanRokomariPageAuthor(after)
    };
  }

  if (candidate) return candidate;

  return {
    titleSuffix: null,
    author: cleanRokomariPageAuthor(text)
  };
}

function combineRokomariTitle(baseTitle, titleSuffix) {
  const base = cleanText(baseTitle);
  let suffix = cleanText(titleSuffix);
  if (!base) return suffix;
  if (!suffix) return base;
  if (suffix.startsWith(base)) return suffix;

  const normalizePart = (value) => cleanText(value)?.replace(/[:：-]/gu, " ").replace(/\s+/g, " ");
  const normalizedBase = normalizePart(base);
  const normalizedSuffix = normalizePart(suffix);
  if (
    numericPartPattern.test(suffix) &&
    normalizedBase &&
    normalizedSuffix &&
    (normalizedBase === normalizedSuffix || normalizedBase.endsWith(` ${normalizedSuffix}`))
  ) {
    return base;
  }
  if (numericPartPattern.test(suffix) && /\p{Decimal_Number}$/u.test(base)) return cleanText(`${base}-${suffix}`);
  if (normalizedBase && normalizedSuffix && normalizedSuffix.length > 1 && normalizedBase.includes(normalizedSuffix)) return base;

  const leadingParen = suffix.match(/^(\([^)]{1,20}\))\s*(.*)$/u);
  if (leadingParen && base.includes(leadingParen[1])) {
    suffix = cleanText(leadingParen[2]);
  }

  const baseTokens = base.split(/\s+/).filter(Boolean);
  for (let count = Math.min(4, baseTokens.length); count > 0; count -= 1) {
    const tail = baseTokens.slice(-count).join(" ");
    if (suffix === tail) return base;
    if (suffix.startsWith(`${tail} `)) {
      suffix = cleanText(suffix.slice(tail.length));
      break;
    }
  }

  if (!suffix) return base;
  if (/^\p{Decimal_Number}{3,4}$/u.test(base)) return cleanText(`${base}: ${suffix}`);
  return cleanText(`${base} ${suffix}`);
}

function rokomariTitleNeedsPageMetadata(book) {
  const title = cleanText(book?.book_title);
  const url = cleanText(book?.book_url);
  if (!title || !url) return false;
  if (!/^\p{Decimal_Number}{3,4}$/u.test(title)) return false;
  const slug = url.match(/\/book\/\d+\/([^/?#]+)/i)?.[1] || "";
  return !new RegExp(`^${title}$`, "u").test(slug) && !new RegExp(`^${title.replace(/[০-৯]/g, (digit) => "০১২৩৪৫৬৭৮৯".indexOf(digit))}$`).test(slug);
}

function makeId(prefix, value) {
  const base = cleanText(value) || prefix;
  return `${prefix}_${hash(base)}`;
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
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
      aliases: Array.from(new Set([...(previous.aliases || []), ...(row.aliases || [])])),
      source_refs: Array.from(new Set([...(previous.source_refs || []), ...(row.source_refs || [])]))
    });
  }
  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function recordMaps() {
  const maps = {
    sources: new Map(),
    authors: new Map(),
    works: new Map(),
    editions: new Map(),
    contributions: new Map(),
    authorKeyToId: new Map(),
    workKeyToId: new Map()
  };

  if (resetMain) return maps;

  for (const author of readJsonl(paths.authors)) {
    const nameKey = key(author.name_bn || author.name_en || author.id);
    if (nameKey) maps.authorKeyToId.set(nameKey, author.id);
  }

  const authorIdsByWork = new Map();
  for (const contribution of readJsonl(paths.contributions)) {
    if (!contribution.work_id || !contribution.author_id) continue;
    const authorIds = authorIdsByWork.get(contribution.work_id) || [];
    authorIds.push(contribution.author_id);
    authorIdsByWork.set(contribution.work_id, authorIds);
  }

  for (const work of readJsonl(paths.works)) {
    const authorIds = authorIdsByWork.get(work.id) || [""];
    for (const authorId of authorIds) {
      const workKey = key(`${work.title_bn || work.title_en || ""}|${authorId}`);
      if (workKey) maps.workKeyToId.set(workKey, work.id);
    }
  }

  return maps;
}

function key(value) {
  return cleanText(value)
    ?.toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
    .trim();
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
    confidence: Math.max(previous?.confidence || 0, input.confidence || 0.82)
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
    confidence: Math.max(previous?.confidence || 0, input.confidence || 0.82)
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
    confidence: Math.max(previous?.confidence || 0, input.confidence || 0.82)
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
    confidence: Math.max(previous?.confidence || 0, input.confidence || 0.82)
  });
  return id;
}

async function fetchText(url, options = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "user-agent": "boi-dataset-import/0.2 (https://github.com/FahadBinHussain/boi)",
          connection: "close",
          ...(options.headers || {})
        }
      });
      if (!response.ok && response.status !== 206) {
        throw new Error(`Fetch failed ${response.status}: ${url}`);
      }
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
      }
    }
  }
  throw lastError;
}

async function fetchJson(url, options = {}) {
  return JSON.parse(await fetchText(url, options));
}

function parseArrayObjectsFromPrefix(text, limit) {
  const rows = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        rows.push(JSON.parse(text.slice(start, index + 1)));
        start = -1;
        if (rows.length >= limit) break;
      }
    }
  }

  return rows;
}

async function importRokomari(maps) {
  const sourceId = addSource(maps, {
    id: "source_rokomaribg_hf_dataset",
    source: "RokomariBG Hugging Face dataset",
    url: "https://huggingface.co/datasets/DevnilMaster1/Bangla-Book-Recommendation-Dataset",
    retrieved_at: retrievedAt,
    raw_path: "archive/rokomaribg",
    external_id: "DevnilMaster1/Bangla-Book-Recommendation-Dataset",
    record_type: "dataset",
    raw_title: "RokomariBG_Dataset",
    raw_author: null,
    notes: "Public multi-entity Bangla book graph dataset with books, authors, publishers, categories, and reviews."
  });

  const authorUrl = "https://huggingface.co/datasets/DevnilMaster1/Bangla-Book-Recommendation-Dataset/resolve/main/author.json";
  const bookUrl = "https://huggingface.co/datasets/DevnilMaster1/Bangla-Book-Recommendation-Dataset/resolve/main/book.json";
  const relationUrl = "https://huggingface.co/datasets/DevnilMaster1/Bangla-Book-Recommendation-Dataset/resolve/main/book_to_author.json";
  const authors = JSON.parse(await fetchText(authorUrl));
  const relations = JSON.parse(await fetchText(relationUrl));
  const bookPrefix = await fetchText(bookUrl, { headers: { range: `bytes=0-${config.rokomariBytes}` } });
  const books = parseArrayObjectsFromPrefix(bookPrefix, config.rokomariLimit);
  const authorMap = new Map(authors.map((author) => [String(author.author_id), author]));
  const sampleBookIds = new Set(books.map((book) => String(book.book_id)));
  const relationsByBook = new Map();
  for (const relation of relations) {
    const list = relationsByBook.get(String(relation.book_id)) || [];
    list.push(String(relation.author_id));
    relationsByBook.set(String(relation.book_id), list);
  }
  const usedAuthors = new Set(
    books
      .flatMap((book) => [String(book.author_id || ""), ...(relationsByBook.get(String(book.book_id)) || [])])
      .filter((authorId) => authorId && authorMap.has(authorId))
  );

  writeJson(path.join(rawDir, "rokomaribg", "sample-books.json"), books);
  writeJson(
    path.join(rawDir, "rokomaribg", "sample-book-to-author.json"),
    relations.filter((relation) => sampleBookIds.has(String(relation.book_id)))
  );
  writeJson(
    path.join(rawDir, "rokomaribg", "sample-authors.json"),
    authors.filter((author) => usedAuthors.has(String(author.author_id)))
  );

  const pageAuthorFallbacks = [];
  const skippedAuthorlessBooks = [];
  const skippedInvalidBooks = [];

  for (const book of books) {
    if (isRokomariPlaceholderBook(book)) {
      skippedInvalidBooks.push({
        book_id: book.book_id,
        book_title: cleanText(book.book_title),
        book_url: book.book_url || null,
        reason: "Placeholder/category record, not a concrete Rokomari book page."
      });
      continue;
    }

    const authorIdsFromDataset = Array.from(
      new Set([...(relationsByBook.get(String(book.book_id)) || []), String(book.author_id || "")])
    ).filter((authorId) => authorMap.has(authorId));

    const datasetAuthors = authorIdsFromDataset
      .map((sourceAuthorId) => ({
        sourceAuthorId,
        rawAuthor: authorMap.get(sourceAuthorId),
        authorName: cleanText(authorMap.get(sourceAuthorId)?.author)
      }))
      .filter((author) => author.authorName);

    let pageMetadata = null;
    let pageAuthor = null;
    const needsPageTitle = rokomariTitleNeedsPageMetadata(book);
    if ((datasetAuthors.length === 0 || needsPageTitle) && book.book_url) {
      pageMetadata = await fetchRokomariPageMetadata(book.book_url, book.book_title);
      pageAuthor = pageMetadata?.author || null;
      if (pageAuthor && datasetAuthors.length === 0) {
        pageAuthorFallbacks.push({
          book_id: book.book_id,
          book_title: pageMetadata.title || cleanText(book.book_title),
          book_url: book.book_url,
          author: pageAuthor,
          raw_author: pageMetadata.raw_author || null
        });
      }
    }

    if (datasetAuthors.length === 0 && !pageAuthor) {
      skippedAuthorlessBooks.push({
        book_id: book.book_id,
        book_title: cleanText(book.book_title),
        book_url: book.book_url || null,
        reason: "No matching author in author.json/book_to_author.json and no author found in public page title."
      });
      continue;
    }

    const resolvedBookTitle = pageMetadata?.title || cleanText(book.book_title);

    const bookSourceId = addSource(maps, {
      id: `source_rokomari_book_${book.book_id}`,
      source: "RokomariBG book record",
      url: book.book_url || null,
      retrieved_at: retrievedAt,
      raw_path: "archive/rokomaribg/sample-books.json",
      external_id: String(book.book_id),
      record_type: "book",
      raw_title: resolvedBookTitle,
      raw_author: cleanText([...datasetAuthors.map((author) => author.authorName), pageAuthor].filter(Boolean).join("; ")),
      notes: book.book_summary ? cleanText(book.book_summary).slice(0, 320) : null
    });

    const authorIds = [];
    for (const { sourceAuthorId, rawAuthor, authorName } of datasetAuthors) {
      authorIds.push(
        addAuthor(maps, {
          id: `author_rokomari_${sourceAuthorId}`,
          name_bn: hasBangla(authorName) ? authorName : null,
          name_en: hasBangla(authorName) ? null : authorName,
          aliases: [],
          country_or_region: null,
          notes: rawAuthor?.known_for_tokens ? cleanText(rawAuthor.known_for_tokens) : null,
          source_refs: [sourceId],
          confidence: 0.88
        })
      );
    }

    if (pageAuthor) {
      authorIds.push(
        addAuthor(maps, {
          id: `author_rokomari_page_${book.book_id}`,
          name_bn: hasBangla(pageAuthor) ? pageAuthor : null,
          name_en: hasBangla(pageAuthor) ? null : pageAuthor,
          aliases: [],
          country_or_region: null,
          notes: "Author recovered from the public Rokomari book page title.",
          source_refs: [bookSourceId],
          confidence: 0.76
        })
      );
    }

    if (authorIds.length === 0) continue;

    const workId = addWork(maps, {
      id: `work_rokomari_${book.book_id}`,
      title_bn: hasBangla(resolvedBookTitle) ? resolvedBookTitle : null,
      title_en: hasBangla(resolvedBookTitle) ? null : resolvedBookTitle,
      aliases: [],
      language: "bn",
      genre: null,
      source_refs: [sourceId, bookSourceId],
      confidence: 0.86,
      author_id: authorIds[0]
    });

    const editionId = addEdition(maps, {
      id: `edition_rokomari_${book.book_id}`,
      work_id: workId,
      title_as_printed: resolvedBookTitle,
      publisher: null,
      publication_year: null,
      isbn: cleanText(book.isbn),
      pages: Number.isFinite(Number(book.book_pages)) ? Number(book.book_pages) : null,
      format: "book",
      source_refs: [sourceId, bookSourceId],
      confidence: 0.84
    });

    for (const authorId of authorIds) {
      addContribution(maps, {
        work_id: workId,
        edition_id: editionId,
        author_id: authorId,
        role: "author",
        source_refs: [sourceId, bookSourceId],
        confidence: 0.86
      });
    }
  }

  writeJson(path.join(rawDir, "rokomaribg", "page-author-fallbacks.json"), pageAuthorFallbacks);
  writeJson(path.join(rawDir, "rokomaribg", "skipped-authorless-books.json"), skippedAuthorlessBooks);
  writeJson(path.join(rawDir, "rokomaribg", "skipped-invalid-books.json"), skippedInvalidBooks);

  return books.length;
}

function metaContent(html, attrName, attrValue) {
  for (const match of String(html || "").matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const attrMatch = tag.match(new RegExp(`${attrName}\\s*=\\s*(['"])${attrValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`, "i"));
    if (!attrMatch) continue;
    const contentMatch = tag.match(/\bcontent\s*=\s*(['"])(.*?)\1/i);
    if (contentMatch) return cleanText(decodeHtmlEntities(contentMatch[2]));
  }
  return null;
}

function rokomariMetaAuthor(html) {
  const ogDescription = metaContent(html, "property", "og:description");
  const description = metaContent(html, "name", "description");
  const ogTitle = metaContent(html, "property", "og:title");

  const labeled = ogDescription?.match(/লেখক\s*[:ঃ]\s*([^,।]+)/u)?.[1];
  const sentence = description?.match(/^(.+?)\s+এর\s+/u)?.[1];
  const titleTail = ogTitle?.match(/\s+-\s+([^-]+)$/u)?.[1];
  const author = cleanRokomariPageAuthor(labeled || sentence || titleTail);

  return author && !isRokomariNonAuthor(author) ? author : null;
}

function parseRokomariPageTitle(pageTitle, bookTitle, authorOverride = null) {
  const cleaned = cleanText(pageTitle)?.replace(/\s*\|\s*Rokomari\.com\s*$/i, "");
  if (!cleaned) return null;

  const prefix = cleanText(bookTitle);
  let authorSegment = cleaned;
  if (prefix && cleaned.startsWith(`${prefix}:`)) {
    authorSegment = cleanText(cleaned.slice(prefix.length + 1));
  } else if (prefix && cleaned.startsWith(prefix)) {
    authorSegment = cleanText(cleaned.slice(prefix.length).replace(/^[\s:：-]+/u, ""));
  } else {
    const parts = cleaned.split(":");
    if (parts.length >= 2) authorSegment = cleanText(parts.slice(1).join(":"));
  }

  const parsed = splitRokomariTitleAuthor(authorSegment);
  let titleSuffix = parsed.titleSuffix;
  if (!titleSuffix && authorOverride && isRokomariNonAuthor(parsed.author)) {
    titleSuffix = parsed.author;
  }

  let author = authorOverride || parsed.author;
  const bilingualParts = String(author || "").split(/\s+-\s+/);
  if (bilingualParts.length > 1 && hasBangla(bilingualParts[0])) {
    author = cleanRokomariPageAuthor(bilingualParts[0]);
  }
  if (!author || /rokomari\.com/i.test(author) || author.length > 120 || isRokomariNonAuthor(author)) return null;

  return {
    title: combineRokomariTitle(prefix, titleSuffix),
    author,
    raw_author: authorSegment
  };
}

async function fetchRokomariPageMetadata(url, bookTitle) {
  try {
    const html = await fetchText(url, {
      headers: { "user-agent": "Mozilla/5.0 boi-dataset-import" }
    });
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = cleanText(decodeHtmlEntities(titleMatch?.[1]));
    return parseRokomariPageTitle(title, bookTitle, rokomariMetaAuthor(html));
  } catch (error) {
    return null;
  }
  return null;
}

async function importWikidata(maps) {
  const query = `
SELECT ?work ?workLabel ?author ?authorLabel ?pubDate ?genreLabel WHERE {
  ?work wdt:P407 wd:Q9610;
        wdt:P50 ?author;
        wdt:P31 ?instance.
  VALUES ?instance { wd:Q571 wd:Q8261 wd:Q49084 wd:Q7725634 wd:Q47461344 wd:Q3331189 }
  OPTIONAL { ?work wdt:P577 ?pubDate. }
  OPTIONAL { ?work wdt:P136 ?genre. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "bn,en". }
}
LIMIT ${config.wikidataLimit}
`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const data = await fetchJson(url);
  writeJson(path.join(rawDir, "wikidata", "bengali-language-works.json"), data);

  for (const binding of data.results.bindings) {
    const workQid = binding.work.value.split("/").pop();
    const authorLabel = cleanText(binding.authorLabel?.value);
    if (!isUsableAuthorName(authorLabel)) continue;

    const workSourceId = addSource(maps, {
      id: `source_wikidata_${workQid}`,
      source: "Wikidata",
      url: `https://www.wikidata.org/wiki/${workQid}`,
      retrieved_at: retrievedAt,
      raw_path: "archive/wikidata/bengali-language-works.json",
      external_id: workQid,
      record_type: "work",
      raw_title: cleanText(binding.workLabel?.value),
      raw_author: authorLabel,
      notes: "Wikidata item with Bengali language (P407), author (P50), and a direct literary/book instance type (P31)."
    });

    const authorQid = binding.author.value.split("/").pop();
    const authorSourceId = addSource(maps, {
      id: `source_wikidata_${authorQid}`,
      source: "Wikidata",
      url: `https://www.wikidata.org/wiki/${authorQid}`,
      retrieved_at: retrievedAt,
      raw_path: "archive/wikidata/bengali-language-works.json",
      external_id: authorQid,
      record_type: "author",
      raw_title: authorLabel,
      raw_author: null,
      notes: "Author linked from a Bengali-language Wikidata work."
    });
    const names = splitMixedName(authorLabel);
    const authorId = addAuthor(maps, {
      id: `author_wikidata_${authorQid}`,
      name_bn: names.bn,
      name_en: names.en,
      aliases: [],
      source_refs: [authorSourceId],
      confidence: 0.9
    });

    const titles = splitMixedName(binding.workLabel?.value);
    const workId = addWork(maps, {
      id: `work_wikidata_${workQid}`,
      title_bn: titles.bn,
      title_en: titles.en,
      aliases: [],
      language: "bn",
      genre: cleanText(binding.genreLabel?.value),
      first_published_year: yearFrom(binding.pubDate?.value),
      source_refs: [workSourceId],
      confidence: 0.9,
      author_id: authorId
    });

    if (authorId) {
      addContribution(maps, {
        work_id: workId,
        author_id: authorId,
        role: "author",
        source_refs: [workSourceId],
        confidence: 0.9
      });
    }
  }

  return data.results.bindings.length;
}

async function importOpenLibrary(maps) {
  const queries = [
    "language:ben",
    "subject:bengali_literature",
    "subject:bangla",
    "subject:bengali",
    "subject:bengali_fiction",
    "subject:bengali_poetry",
    "Humayun Ahmed",
    "Rabindranath Tagore",
    "Sarat Chandra Chattopadhyay",
    "Kazi Nazrul Islam",
    "Begum Rokeya",
    "Jibanananda Das",
    "Muhammed Zafar Iqbal",
    "Selina Hossain",
    "Syed Shamsul Haq",
    "Bibhutibhushan Bandyopadhyay",
    "Bankim Chandra Chattopadhyay",
    "Sunil Gangopadhyay",
    "Shirshendu Mukhopadhyay"
  ];
  const docsByKey = new Map();
  const raw = [];

  for (const query of queries) {
    if (docsByKey.size >= config.openLibraryLimit) break;
    for (let page = 1; page <= 8; page += 1) {
      if (docsByKey.size >= config.openLibraryLimit) break;
      const url = `https://openlibrary.org/search.json?language=ben&fields=key,title,author_name,author_key,first_publish_year,edition_count,isbn,has_fulltext&limit=100&page=${page}&q=${encodeURIComponent(query)}`;
      const data = await fetchJson(url);
      const docs = data.docs || [];
      raw.push({ query, page, numFound: data.numFound || 0, docs });
      for (const doc of docs) {
        const authors = (doc.author_name || []).filter((name) => isUsableAuthorName(name));
        if (!authors.length) continue;
        if (doc.key && !docsByKey.has(doc.key)) docsByKey.set(doc.key, doc);
        if (docsByKey.size >= config.openLibraryLimit) break;
      }
      if (docs.length < 100) break;
    }
  }

  writeJson(path.join(rawDir, "openlibrary", "bengali-searches.json"), raw);

  for (const doc of docsByKey.values()) {
    const docAuthors = (doc.author_name || [])
      .map((name, index) => ({ name, key: doc.author_key?.[index] }))
      .filter((author) => isUsableAuthorName(author.name));

    const sourceId = addSource(maps, {
      id: `source_openlibrary_${hash(doc.key)}`,
      source: "Open Library",
      url: `https://openlibrary.org${doc.key}`,
      retrieved_at: retrievedAt,
      raw_path: "archive/openlibrary/bengali-searches.json",
      external_id: doc.key,
      record_type: "work",
      raw_title: cleanText(doc.title),
      raw_author: cleanText((doc.author_name || []).join("; ")),
      notes: `Open Library work search result; edition_count=${doc.edition_count ?? "unknown"}.`
    });

    const authorIds = [];
    docAuthors.slice(0, 4).forEach((author) => {
      const names = splitMixedName(author.name);
      authorIds.push(
        addAuthor(maps, {
          id: author.key ? `author_openlibrary_${author.key}` : undefined,
          name_bn: names.bn,
          name_en: names.en,
          aliases: [],
          source_refs: [sourceId],
          confidence: 0.82
        })
      );
    });
    if (!authorIds.length) continue;

    const titles = splitMixedName(doc.title);
    const workId = addWork(maps, {
      id: `work_openlibrary_${hash(doc.key)}`,
      title_bn: titles.bn,
      title_en: titles.en,
      aliases: [],
      language: "bn",
      genre: null,
      first_published_year: Number.isFinite(doc.first_publish_year) ? doc.first_publish_year : null,
      source_refs: [sourceId],
      confidence: 0.82,
      author_id: authorIds[0]
    });

    const editionId = addEdition(maps, {
      id: `edition_openlibrary_${hash(doc.key)}`,
      work_id: workId,
      title_as_printed: cleanText(doc.title),
      publisher: null,
      publication_year: Number.isFinite(doc.first_publish_year) ? doc.first_publish_year : null,
      isbn: Array.isArray(doc.isbn) ? cleanText(doc.isbn[0]) : null,
      pages: null,
      format: doc.has_fulltext ? "digital/print" : "catalog",
      source_refs: [sourceId],
      confidence: 0.78
    });

    authorIds.forEach((authorId) => {
      addContribution(maps, {
        work_id: workId,
        edition_id: editionId,
        author_id: authorId,
        role: "author",
        source_refs: [sourceId],
        confidence: 0.8
      });
    });
  }

  return docsByKey.size;
}

async function importInternetArchive(maps) {
  const queries = [
    'languageSorter:"Bengali" AND mediatype:texts',
    'languageSorter:"Bengali" AND mediatype:texts AND subject:"Bengali literature"',
    'languageSorter:"Bengali" AND mediatype:texts AND (creator:"Tagore" OR creator:"Sarat")',
    'languageSorter:"Bengali" AND mediatype:texts AND collection:digitallibraryindia',
    'languageSorter:"Bengali" AND mediatype:texts AND collection:opensource',
    'languageSorter:"Bengali" AND mediatype:texts AND collection:universallibrary'
  ];
  const docsById = new Map();
  const raw = [];

  for (const query of queries) {
    if (docsById.size >= config.internetArchiveLimit) break;
    for (let page = 1; page <= 12; page += 1) {
      if (docsById.size >= config.internetArchiveLimit) break;
      const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=description&fl[]=date&fl[]=publisher&rows=100&page=${page}&output=json`;
      const data = await fetchJson(url);
      const docs = data.response?.docs || [];
      raw.push({ query, page, numFound: data.response?.numFound || 0, docs });
      for (const doc of docs) {
        const normalizedDoc = normalizeInternetArchiveDoc(doc);
        if (doc.identifier && normalizedDoc.creators.length && normalizedDoc.title && !docsById.has(doc.identifier)) {
          docsById.set(doc.identifier, doc);
        }
        if (docsById.size >= config.internetArchiveLimit) break;
      }
      if (docs.length < 100) break;
    }
  }

  writeJson(path.join(rawDir, "internet-archive", "bengali-texts.json"), raw);

  for (const doc of docsById.values()) {
    const normalizedDoc = normalizeInternetArchiveDoc(doc);
    const sourceId = addSource(maps, {
      id: `source_internet_archive_${hash(doc.identifier)}`,
      source: "Internet Archive",
      url: `https://archive.org/details/${doc.identifier}`,
      retrieved_at: retrievedAt,
      raw_path: "archive/internet-archive/bengali-texts.json",
      external_id: doc.identifier,
      record_type: "edition",
      raw_title: cleanText(doc.title),
      raw_author: cleanText(Array.isArray(doc.creator) ? doc.creator.join("; ") : doc.creator),
      notes: normalizedDoc.cleanedFromDescription
        ? "Bengali-language text metadata returned by Internet Archive advanced search; title/author normalized from item description because archive title/creator contained packaging text."
        : "Bengali-language text metadata returned by Internet Archive advanced search."
    });

    const authorIds = normalizedDoc.creators.slice(0, 3).map((creator) => {
      const names = splitMixedName(creator);
      return addAuthor(maps, {
        name_bn: names.bn,
        name_en: names.en,
        aliases: [],
        source_refs: [sourceId],
        confidence: 0.76
      });
    });

    const titles = splitMixedName(normalizedDoc.title);
    const workId = addWork(maps, {
      title_bn: titles.bn,
      title_en: titles.en,
      aliases: [],
      language: "bn",
      genre: null,
      first_published_year: normalizedDoc.publicationYear,
      source_refs: [sourceId],
      confidence: 0.76,
      author_id: authorIds[0]
    });

    const editionId = addEdition(maps, {
      id: `edition_internet_archive_${hash(doc.identifier)}`,
      work_id: workId,
      title_as_printed: normalizedDoc.title,
      publisher: cleanText(Array.isArray(doc.publisher) ? doc.publisher.join("; ") : doc.publisher),
      publication_year: normalizedDoc.publicationYear,
      isbn: null,
      pages: null,
      format: "digital scan",
      source_refs: [sourceId],
      confidence: 0.76
    });

    authorIds.forEach((authorId) => {
      addContribution(maps, {
        work_id: workId,
        edition_id: editionId,
        author_id: authorId,
        role: "author",
        source_refs: [sourceId],
        confidence: 0.76
      });
    });
  }

  return docsById.size;
}

function parseAnchorLinks(html) {
  return [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
    href: match[1],
    text: cleanText(match[2])
  }));
}

function absoluteUrl(base, href) {
  try {
    return new URL(decodeHtmlEntities(href), base).toString();
  } catch {
    return null;
  }
}

function cleanHtmlText(value) {
  return cleanText(decodeHtmlEntities(String(value || "").replace(/<br\s*\/?>/gi, " | ")));
}

function extractMaxPage(html) {
  let maxPage = 1;
  for (const match of String(html || "").matchAll(/[?&]page=(\d+)/gi)) {
    maxPage = Math.max(maxPage, Number(match[1]));
  }
  return maxPage;
}

function splitBooksComBdTitle(titleHtml) {
  const spanTexts = [...String(titleHtml || "").matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => cleanHtmlText(match[1]))
    .filter(Boolean);
  const outsideSpan = cleanHtmlText(String(titleHtml || "").replace(/<span[^>]*>[\s\S]*?<\/span>/gi, ""));
  const pieces = [
    ...(outsideSpan ? outsideSpan.split(/\s*\|\s*/).map(cleanText).filter(Boolean) : []),
    ...spanTexts
  ];
  const titleBn = pieces.find((piece) => hasBangla(piece)) || null;
  const titleAlias = pieces.find((piece) => /[A-Za-z]/.test(piece) && !hasBangla(piece)) || null;
  return { title_bn: titleBn, title_alias: titleAlias };
}

function parseBooksComBdCards(html, pageUrl, rawPath) {
  const rows = [];
  const cardBlocks = String(html || "").split(/<div\s+class=["'][^"']*c-content-product-2/gi).slice(1);

  for (const block of cardBlocks) {
    const hrefs = [...block.matchAll(/href=["']([^"']+)["']/gi)]
      .map((match) => absoluteUrl(pageUrl, match[1]))
      .filter(Boolean);
    const detailUrl = hrefs.find((url) => /^https?:\/\/(?:www\.)?books\.com\.bd\/\d+\/?$/i.test(url));
    if (!detailUrl) continue;

    const externalId = detailUrl.match(/\/(\d+)\/?$/)?.[1];
    const coverMatch = block.match(/background-image\s*:\s*url\((["']?)([^"')]+)\1\)/i);
    const coverUrl = coverMatch ? absoluteUrl(pageUrl, coverMatch[2]) : null;
    const infoMatch = block.match(/<div\s+class=["'][^"']*c-info[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const infoHtml = infoMatch?.[1] || block;
    const titleMatch = infoHtml.match(/<p\s+class=["'][^"']*c-title[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    if (!titleMatch) continue;

    const titleParts = splitBooksComBdTitle(titleMatch[1]);
    const paragraphs = [...infoHtml.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)];
    const author = paragraphs
      .filter((match) => !/c-title|c-price/i.test(match[1]))
      .map((match) => cleanHtmlText(match[2]))
      .find((text) => text && isUsableAuthorName(text)) || null;
    const price = cleanHtmlText(infoHtml.match(/<p\s+class=["'][^"']*c-price[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]);

    rows.push({
      id: externalId,
      url: detailUrl,
      title_bn: titleParts.title_bn,
      title_alias: titleParts.title_alias,
      raw_title: cleanHtmlText(titleMatch[1]),
      author_bn: author,
      price,
      cover_url: coverUrl,
      page_url: pageUrl,
      raw_path: rawPath
    });
  }

  return rows;
}

function addBooksComBdRows(maps, rows, notes) {
  const seenBooks = new Set();
  let promoted = 0;

  for (const row of rows) {
    if (!row.id || seenBooks.has(row.id)) continue;
    seenBooks.add(row.id);
    if (!row.title_bn || !hasBangla(row.title_bn)) continue;

    const rawTitleParts = String(row.raw_title || "")
      .split(/\s*\|\s*/u)
      .map(cleanText)
      .filter(Boolean);
    const embeddedAuthor = rawTitleParts.find(
      (part) => hasBangla(part) && key(part) !== key(row.title_bn) && isUsableAuthorName(part)
    );
    const authorName = row.author_bn && isUsableAuthorName(row.author_bn) ? row.author_bn : embeddedAuthor || null;

    const sourceId = addSource(maps, {
      id: `source_books_com_bd_${row.id}`,
      source: "Books.com.bd",
      url: row.url,
      retrieved_at: retrievedAt,
      raw_path: row.raw_path,
      external_id: row.id,
      record_type: "book",
      raw_title: row.raw_title || row.title_bn,
      raw_author: authorName,
      notes: `${notes}${authorName ? "" : " Source card/detail page did not expose an author."}${row.price ? ` Price shown on source card: ${row.price}.` : ""}${row.cover_url ? ` Cover image: ${row.cover_url}.` : ""}`
    });

    const authorId = authorName
      ? addAuthor(maps, {
          id: `author_books_com_bd_${hash(authorName)}`,
          name_bn: authorName,
          name_en: null,
          aliases: [],
          source_refs: [sourceId],
          confidence: 0.82
        })
      : null;

    const workId = addWork(maps, {
      id: `work_books_com_bd_${hash(`${row.title_bn}|${authorId || row.id}`)}`,
      title_bn: row.title_bn,
      title_en: null,
      aliases: row.title_alias ? [row.title_alias] : [],
      language: "bn",
      genre: null,
      first_published_year: null,
      source_refs: [sourceId],
      confidence: 0.82,
      author_id: authorId
    });

    const editionId = addEdition(maps, {
      id: `edition_books_com_bd_${row.id}`,
      work_id: workId,
      title_as_printed: row.raw_title || row.title_bn,
      publisher: null,
      publication_year: null,
      isbn: null,
      pages: null,
      format: "catalog",
      source_refs: [sourceId],
      confidence: 0.82
    });

    if (authorId) {
      addContribution(maps, {
        work_id: workId,
        edition_id: editionId,
        author_id: authorId,
        role: "author",
        source_refs: [sourceId],
        confidence: 0.82
      });
    }
    promoted += 1;
  }

  return promoted;
}

function mergeBookRowsById(existingRows, incomingRows) {
  const rowsById = new Map();
  for (const row of [...(existingRows || []), ...(incomingRows || [])]) {
    const key = row?.id || row?.url || row?.href;
    if (!key) continue;
    rowsById.set(key, { ...(rowsById.get(key) || {}), ...row });
  }
  return Array.from(rowsById.values()).sort((a, b) => String(a.id || a.url).localeCompare(String(b.id || b.url)));
}

function mergeRawPages(existingPages, incomingPages) {
  const pagesByKey = new Map();
  for (const page of [...(existingPages || []), ...(incomingPages || [])]) {
    const key = `${page.author_url || ""}|${page.books_url || ""}|${page.page || ""}`;
    pagesByKey.set(key, { ...(pagesByKey.get(key) || {}), ...page });
  }
  return Array.from(pagesByKey.values());
}

async function importAuthorsAndBooksDotBd(maps) {
  const authorsHtml = await fetchText("https://authors.com.bd/", {
    headers: { "user-agent": "Mozilla/5.0 boi-dataset-import" }
  });
  const booksHtml = await fetchText("https://books.com.bd/", {
    headers: { "user-agent": "Mozilla/5.0 boi-dataset-import" }
  });
  const seenAuthorProfiles = new Set();
  const authorLinks = parseAnchorLinks(authorsHtml)
    .map((link) => ({ ...link, href: absoluteUrl("https://authors.com.bd/", link.href) }))
    .filter((link) => {
      if (!/^https?:\/\/authors\.com\.bd\/\d+\/?$/i.test(link.href)) return false;
      if (!link.text || !hasBangla(link.text)) return false;
      if (/^(Profile|Info|Books\b)/i.test(link.text)) return false;
      if (seenAuthorProfiles.has(link.href)) return false;
      seenAuthorProfiles.add(link.href);
      return true;
    })
    .slice(0, config.authorsComBdAuthorLimit);
  const homepageBookCards = parseBooksComBdCards(
    booksHtml,
    "https://books.com.bd/",
    "archive/books-com-bd/homepage-books-extract.json"
  );

  const authorBookPages = [];
  const authorBookCards = [];
  for (const link of authorLinks) {
    const booksUrl = `${link.href.replace(/\/?$/, "/")}Books/`;
    if (!booksUrl) continue;
    let firstPageHtml = null;
    try {
      firstPageHtml = await fetchText(booksUrl, {
        headers: { "user-agent": "Mozilla/5.0 boi-dataset-import" }
      });
    } catch (error) {
      authorBookPages.push({ author_url: link.href, books_url: booksUrl, error: error.message });
      continue;
    }

    const maxPage = Math.min(extractMaxPage(firstPageHtml), config.authorsComBdAuthorBookPageLimit);
    for (let page = 1; page <= maxPage; page += 1) {
      const pageUrl = page === 1 ? booksUrl : `${booksUrl.replace(/\/?$/, "/")}?page=${page}`;
      let pageHtml = firstPageHtml;
      if (page > 1) {
        try {
          pageHtml = await fetchText(pageUrl, {
            headers: { "user-agent": "Mozilla/5.0 boi-dataset-import" }
          });
        } catch (error) {
          authorBookPages.push({ author_url: link.href, books_url: pageUrl, page, error: error.message });
          continue;
        }
      }

      const rows = parseBooksComBdCards(
        pageHtml,
        pageUrl,
        "archive/authors-com-bd/author-books-extract.json"
      );
      authorBookPages.push({ author_url: link.href, books_url: pageUrl, page, book_count: rows.length });
      authorBookCards.push(...rows);
    }
  }

  const listBookPages = [];
  const listBookCards = [];
  for (let page = 1; page <= config.booksComBdListPageLimit; page += 1) {
    const pageUrl = page === 1 ? "https://books.com.bd/List/" : `https://books.com.bd/List/?page=${page}`;
    try {
      const pageHtml = page === 1 ? await fetchText(pageUrl, {
        headers: { "user-agent": "Mozilla/5.0 boi-dataset-import" }
      }) : await fetchText(pageUrl, {
        headers: { "user-agent": "Mozilla/5.0 boi-dataset-import" }
      });
      const rows = parseBooksComBdCards(pageHtml, pageUrl, "archive/books-com-bd/list-books-extract.json");
      listBookPages.push({ books_url: pageUrl, page, book_count: rows.length });
      listBookCards.push(...rows);
    } catch (error) {
      listBookPages.push({ books_url: pageUrl, page, error: error.message });
    }
  }

  const authorsHomepagePath = path.join(rawDir, "authors-com-bd", "homepage-extract.json");
  const authorBooksPath = path.join(rawDir, "authors-com-bd", "author-books-extract.json");
  const booksHomepagePath = path.join(rawDir, "books-com-bd", "homepage-books-extract.json");
  const booksListPath = path.join(rawDir, "books-com-bd", "list-books-extract.json");

  writeJson(authorsHomepagePath, mergeBookRowsById(readJson(authorsHomepagePath, []), authorLinks));
  const existingAuthorBooks = readJson(authorBooksPath, { pages: [], books: [] });
  writeJson(authorBooksPath, {
    pages: mergeRawPages(existingAuthorBooks.pages, authorBookPages),
    books: mergeBookRowsById(existingAuthorBooks.books, authorBookCards)
  });
  writeJson(booksHomepagePath, mergeBookRowsById(readJson(booksHomepagePath, []), homepageBookCards));
  const existingListBooks = readJson(booksListPath, { pages: [], books: [] });
  writeJson(booksListPath, {
    pages: mergeRawPages(existingListBooks.pages, listBookPages),
    books: mergeBookRowsById(existingListBooks.books, listBookCards)
  });

  let count = 0;
  for (const link of authorLinks) {
    const authorExternalId = link.href.split("/").filter(Boolean).pop();
    const sourceId = addSource(maps, {
      id: `source_authors_com_bd_${hash(link.href)}`,
      source: "Authors.com.bd",
      url: link.href,
      retrieved_at: retrievedAt,
      raw_path: "archive/authors-com-bd/homepage-extract.json",
      external_id: authorExternalId,
      record_type: "author",
      raw_title: link.text,
      raw_author: null,
      notes: "Author profile link surfaced on Authors.com.bd homepage."
    });
    const names = splitMixedName(link.text);
    addAuthor(maps, {
      id: `author_authors_com_bd_${authorExternalId}`,
      name_bn: names.bn,
      name_en: names.en,
      aliases: [],
      source_refs: [sourceId],
      confidence: 0.82
    });
    count += 1;
  }

  const allBookCards = [...homepageBookCards, ...authorBookCards, ...listBookCards];
  const promotedBooks = addBooksComBdRows(
    maps,
    allBookCards,
    "Books.com.bd catalog card with visible title and author metadata."
  );

  return {
    author_profiles: count,
    homepage_book_cards: homepageBookCards.length,
    author_book_cards: authorBookCards.length,
    list_book_cards: listBookCards.length,
    promoted_books: promotedBooks
  };
}

function addReferenceCatalogSources(maps) {
  const catalogs = [
    {
      id: "source_nbil_catalog_reference",
      source: "National Bibliography of Indian Literature reference lane",
      url: "https://archive.org/search?query=%22National+Bibliography+of+Indian+Literature%22+Bengali",
      raw_path: "archive/nbil",
      notes: "Reference lane for future NBIL volume imports; kept separate because this pass only records catalog source metadata."
    },
    {
      id: "source_worldcat_bengali_reference",
      source: "WorldCat Bengali bibliography reference lane",
      url: "https://search.worldcat.org/search?q=Bengali+literature",
      raw_path: "archive/nbil",
      notes: "Reference lane for future library catalog reconciliation."
    }
  ];

  for (const catalog of catalogs) {
    addSource(maps, {
      ...catalog,
      retrieved_at: retrievedAt,
      external_id: catalog.id,
      record_type: "catalog",
      raw_title: catalog.source,
      raw_author: null
    });
  }
  writeJson(path.join(rawDir, "nbil", "reference-catalogs.json"), catalogs);
}

function pruneDanglingWorks(works, editions, contributions) {
  const linkedWorkIds = new Set([
    ...editions.map((edition) => edition.work_id).filter(Boolean),
    ...contributions.map((contribution) => contribution.work_id).filter(Boolean)
  ]);
  return works.filter((work) => linkedWorkIds.has(work.id));
}

function flush(maps) {
  const existing = (filePath) => (resetMain ? [] : readJsonl(filePath));
  const imported = {
    sources: Array.from(maps.sources.values()),
    authors: Array.from(maps.authors.values()).filter((row) => row.name_bn || row.name_en),
    works: Array.from(maps.works.values()).filter((row) => row.title_bn || row.title_en),
    editions: Array.from(maps.editions.values()),
    contributions: Array.from(maps.contributions.values())
  };

  const mergedSources = mergeById(existing(paths.sources), imported.sources);
  const mergedAuthors = mergeById(existing(paths.authors), imported.authors);
  const mergedEditions = mergeById(existing(paths.editions), imported.editions);
  const mergedContributions = mergeById(existing(paths.contributions), imported.contributions);
  const mergedWorks = pruneDanglingWorks(mergeById(existing(paths.works), imported.works), mergedEditions, mergedContributions);

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
  ensureDir(normalizedDir);
  ensureDir(rawDir);

  const maps = recordMaps();
  const counts = {};
  if (process.env.DATASET_IMPORT_SMALL_SOURCES_ONLY === "1") {
    counts.authors_books_bd = await importAuthorsAndBooksDotBd(maps);
    addReferenceCatalogSources(maps);

    const imported = flush(maps);
    console.log(JSON.stringify({ retrieved_at: retrievedAt, source_counts: counts, imported }, null, 2));
    return;
  }

  counts.rokomari = await importRokomari(maps);
  counts.wikidata = await importWikidata(maps);
  counts.openlibrary = await importOpenLibrary(maps);
  counts.internet_archive = await importInternetArchive(maps);
  counts.authors_books_bd = await importAuthorsAndBooksDotBd(maps);
  addReferenceCatalogSources(maps);

  const imported = flush(maps);
  console.log(JSON.stringify({ retrieved_at: retrievedAt, source_counts: counts, imported }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

