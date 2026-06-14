const fs = require("node:fs");
const path = require("node:path");
const { mainDir, exportsDir, generated } = require("./paths");
const { readJsonl } = require("./jsonl-store");

const root = path.resolve(__dirname, "..");
const checkMode = process.argv.includes("--check");
const WORKS_PAGE_SIZE = Number(process.env.DATASET_WORKS_PAGE_SIZE || 250);
const REFERENCES_PAGE_SIZE = Number(process.env.DATASET_REFERENCES_PAGE_SIZE || 10000);
const SORT_KEYS = ["title", "author", "year", "editions"];
const SORT_DIRECTIONS = ["asc", "desc"];

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeOrCheckPath(filePath, data) {
  const next = stableJson(data);

  if (checkMode) {
    const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
    if (current !== next) {
      console.error(`Generated export is stale: ${path.relative(root, filePath)}`);
      process.exitCode = 1;
    }
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, next, "utf8");
}

function writeOrCheck(fileName, data) {
  writeOrCheckPath(path.join(exportsDir, fileName), data);
}

function removeStaleRootExport(fileName) {
  const filePath = path.join(exportsDir, fileName);
  if (!fs.existsSync(filePath)) return;

  if (checkMode) {
    console.error(`Generated export is stale: ${path.relative(root, filePath)}`);
    process.exitCode = 1;
    return;
  }

  fs.unlinkSync(filePath);
}

function paddedPage(page) {
  return String(page).padStart(4, "0");
}

function displayTitle(work) {
  return work.title_bn || work.title_en || work.id;
}

function displayAuthors(work) {
  return (work.authors || []).map((author) => author.name_bn || author.name_en || author.id).join(", ");
}

function compareText(a, b, direction) {
  const result = String(a || "").localeCompare(String(b || ""), ["bn", "en"], {
    sensitivity: "base",
    numeric: true
  });
  return direction === "asc" ? result : -result;
}

function compareNumber(a, b, direction) {
  const emptyA = a === null || a === undefined;
  const emptyB = b === null || b === undefined;
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;
  const result = a - b;
  return direction === "asc" ? result : -result;
}

function sortBookRows(rows, sort, direction) {
  return rows.slice().sort((a, b) => {
    if (sort === "author") {
      return compareText(displayAuthors(a), displayAuthors(b), direction) || compareText(displayTitle(a), displayTitle(b), "asc");
    }

    if (sort === "year") {
      return compareNumber(a.first_published_year, b.first_published_year, direction) || compareText(displayTitle(a), displayTitle(b), "asc");
    }

    if (sort === "editions") {
      return compareNumber(a.edition_count, b.edition_count, direction) || compareText(displayTitle(a), displayTitle(b), "asc");
    }

    return compareText(displayTitle(a), displayTitle(b), direction) || compareText(displayAuthors(a), displayAuthors(b), "asc");
  });
}

function walkJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkJsonFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
  });
}

function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name));
  }
  if (!fs.readdirSync(dir).length) {
    fs.rmdirSync(dir);
  }
}

function cleanStalePagedFiles(relativeRoot, expectedRelativeFiles) {
  const pageRoot = path.join(exportsDir, relativeRoot);
  const expected = new Set(expectedRelativeFiles.map((file) => path.normalize(path.join(exportsDir, file))));
  for (const filePath of walkJsonFiles(pageRoot)) {
    if (expected.has(path.normalize(filePath))) continue;

    if (checkMode) {
      console.error(`Generated export is stale: ${path.relative(root, filePath)}`);
      process.exitCode = 1;
    } else {
      fs.unlinkSync(filePath);
    }
  }

  if (!checkMode) {
    removeEmptyDirs(pageRoot);
  }
}

function pageReferences(rows) {
  const refs = new Set();
  for (const row of rows) {
    for (const ref of row.source_refs || []) refs.add(ref);
    for (const ref of row.edition_source_refs || []) refs.add(ref);
    for (const author of row.authors || []) {
      for (const ref of author.source_refs || []) refs.add(ref);
    }
  }

  return Array.from(refs)
    .map((ref) => sourcesById.get(ref))
    .filter(Boolean)
    .map((source) => ({
      id: source.id,
      source: source.source,
      url: source.url,
      record_type: source.record_type,
      raw_title: source.raw_title
    }));
}

function writePagedBookExport({ name, rows, pageSize, includeReferences }) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const expectedFiles = [];
  const sorts = {};

  for (const sort of SORT_KEYS) {
    sorts[sort] = {};
    for (const direction of SORT_DIRECTIONS) {
      const sortedRows = sortBookRows(rows, sort, direction);
      const pages = [];

      for (let page = 1; page <= pageCount; page += 1) {
        const fileName = `${paddedPage(page)}.json`;
        const relativePath = path.join(name, "pages", sort, direction, fileName);
        const pageRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);
        const pageExport = {
          format_version: 1,
          dataset: name,
          sort,
          direction,
          page,
          page_size: pageSize,
          page_count: pageCount,
          total: rows.length,
          rows: pageRows
        };

        if (includeReferences) {
          pageExport.references = pageReferences(pageRows);
        }

        expectedFiles.push(relativePath);
        pages.push(relativePath.replaceAll("\\", "/"));
        writeOrCheck(relativePath, pageExport);
      }

      sorts[sort][direction] = {
        page_count: pageCount,
        files: pages
      };
    }
  }

  cleanStalePagedFiles(path.join(name, "pages"), expectedFiles);

  writeOrCheck(`${name}-manifest.json`, {
    format_version: 1,
    dataset: name,
    total: rows.length,
    page_size: pageSize,
    page_count: pageCount,
    sort_keys: SORT_KEYS,
    sort_directions: SORT_DIRECTIONS,
    default_sort: {
      key: "title",
      direction: "asc"
    },
    sorts
  });
}

function writePagedRecordExport({ name, rows, pageSize }) {
  const sortedRows = rows.slice().sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const expectedFiles = [];
  const files = [];

  for (let page = 1; page <= pageCount; page += 1) {
    const fileName = `${paddedPage(page)}.json`;
    const relativePath = path.join(name, "pages", fileName);
    const pageRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

    expectedFiles.push(relativePath);
    files.push(relativePath.replaceAll("\\", "/"));
    writeOrCheck(relativePath, {
      format_version: 1,
      dataset: name,
      page,
      page_size: pageSize,
      page_count: pageCount,
      total: sortedRows.length,
      rows: pageRows
    });
  }

  cleanStalePagedFiles(path.join(name, "pages"), expectedFiles);

  writeOrCheck(`${name}-manifest.json`, {
    format_version: 1,
    dataset: name,
    total: sortedRows.length,
    page_size: pageSize,
    page_count: pageCount,
    files
  });
}

function hasBanglaScript(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function isBanglaLanguageWork(work) {
  return work.language === "bn";
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

function hasLatinScript(value) {
  return /[A-Za-z]/.test(String(value || ""));
}

function splitPipeLocalized(value) {
  const text = cleanText(value);
  if (!text || !text.includes("|")) return null;
  const parts = text.split(/\s*\|\s*/).map(cleanText).filter(Boolean);
  if (parts.length < 2) return null;

  const bn = parts.find((part) => hasBanglaScript(part)) || null;
  const en = parts.find((part) => hasLatinScript(part) && !hasBanglaScript(part)) || null;
  return bn || en ? { bn, en } : null;
}

function normalizeLocalizedPair(nameBn, nameEn) {
  const bn = cleanText(nameBn);
  const en = cleanText(nameEn);
  const split = splitPipeLocalized(bn) || splitPipeLocalized(en);

  if (!split) {
    return { bn, en };
  }

  return {
    bn: split.bn || (bn && hasBanglaScript(bn) && !bn.includes("|") ? bn : null),
    en: en && !en.includes("|") && !hasBanglaScript(en) ? en : split.en
  };
}

function normalizedTextKey(value) {
  return cleanText(value)
    ?.toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTrailingTitleSeparators(value) {
  const text = cleanText(value);
  if (!text) return null;
  return cleanText(text.replace(/\s*(?:[,،;:|/\\.]|[-–—])+\s*$/gu, ""));
}

function stripLeadingBanglaTitleSeparators(value) {
  const text = cleanText(value);
  if (!text || !hasBanglaScript(text)) return text;
  return cleanText(text.replace(/^(?:\s*(?:…|\.|[।,;:!?])\s*)+/gu, ""));
}

function countCharacter(value, character) {
  return Array.from(String(value || "")).filter((item) => item === character).length;
}

function stripMarketplaceAuthorQualifier(value) {
  const text = stripDanglingTitleBrackets(value);
  if (!text) return null;

  const match = text.match(/^(.*?)\s*\(([^()]{1,48})\)\s*$/u);
  if (!match) return text;

  const base = cleanText(match[1]);
  const qualifier = cleanText(match[2]);
  if (!base || !qualifier || !hasBanglaScript(base)) return text;
  if (!hasBanglaScript(qualifier) && !/^\p{Decimal_Number}+$/u.test(qualifier)) return text;

  const marketplaceQualifierPattern =
    /^(?:কার্টুনিস্ট|চিত্রশিল্পী|কবি(?:\s+ও\s+সাহিত্যিক)?|বাঙালি\s+কবি|গল্পকার|ছড়াকার|নাট্যকার|উপন্যাসিক|সাংবাদিক(?:\s+ও\s+প্রফেসর)?|তথ্য\s+প্রযুক্তিবিদ|ইতিহাসবিদ|গবেষক|অধ্যাপক|প্রফেসর|বিশেষজ্ঞ|ব্যাংকার|আইসিটি|গণিত|ইলেক্ট্রনিক্স|কেমিস্ট্রি|ভারত|ঢা\.বি\.|অব\.?|অবঃ|ইঞ্জি:|এফসিএমএ|2)$/u;

  return marketplaceQualifierPattern.test(qualifier) ? base : text;
}

function cleanPersonName(value) {
  return stripMarketplaceAuthorQualifier(value);
}

function authorNameVariants(authorNames) {
  const variants = new Set();
  for (const authorName of authorNames) {
    const name = cleanPersonName(authorName);
    if (!name) continue;
    variants.add(name);

    for (const part of name.split(/\s*(?:\||,|،| - | – | — )\s*/u).map(cleanPersonName).filter(Boolean)) {
      variants.add(part);
    }
  }
  return Array.from(variants).sort((a, b) => b.length - a.length);
}

function stripDanglingTitleBrackets(value) {
  let text = stripTrailingTitleSeparators(value);
  if (!text) return null;

  text = cleanText(text.replace(/\s*[\(\[\{（［｛]\s*$/u, ""));
  if (!text) return null;

  const bracketPairs = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
    ["（", "）"],
    ["［", "］"],
    ["｛", "｝"]
  ];

  for (const [open, close] of bracketPairs) {
    let openCount = countCharacter(text, open);
    let closeCount = countCharacter(text, close);

    while (closeCount > openCount && text.endsWith(close)) {
      text = cleanText(text.slice(0, -close.length));
      closeCount -= 1;
    }
  }

  return stripTrailingTitleSeparators(text);
}

function removeTrailingAuthorName(title, authorNames) {
  let cleaned = cleanText(title);
  if (!cleaned) return null;

  cleaned = stripTrailingMetadataNoise(cleaned);
  if (!cleaned) return null;

  const variants = authorNameVariants(authorNames);
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;

    for (const authorName of variants) {
      const name = cleanText(authorName);
      if (!name) continue;

      const escapedName = escapeRegExp(name);
      const roleWords =
        "(?:সম্পাদিত|সম্পাদক|রচিত|লিখিত|অনূদিত|অনুবাদ|সংকলিত|গ্রন্থনা|গ্রন্থিত|edited|editor|translated|compiled|by)";
      const suffixPatterns = [
        new RegExp(`(?:\\s*[,،;|]\\s*|\\s*[-–—]\\s*)${escapedName}(?:\\s+${roleWords})?\\.?\\s*$`, "iu"),
        new RegExp(`\\s+${escapedName}\\s+${roleWords}\\.?\\s*$`, "iu"),
        new RegExp(`\\s+${escapedName}\\.?\\s*$`, "iu")
      ];

      for (const suffixPattern of suffixPatterns) {
        const next = cleanText(cleaned.replace(suffixPattern, ""));
        if (next && next !== cleaned && titleCanSafelyLoseTrailingAuthor(next)) {
          cleaned = next;
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  return stripDanglingTitleBrackets(cleaned);
}

function removeTrailingAuthorsFromTitles(titles, authors) {
  const authorNames = authors.flatMap((author) => [author.name_bn, author.name_en]).filter(Boolean);
  return {
    ...titles,
    bn: removeTrailingAuthorName(titles.bn, authorNames),
    en: removeTrailingAuthorName(titles.en, authorNames)
  };
}

function splitTrailingLatinParentheticalTitle(titles) {
  const bn = cleanText(titles.bn);
  const en = cleanText(titles.en);
  if (!bn || (en && hasUsefulEnglishTitleCue(en)) || !hasBanglaScript(bn)) return titles;

  const match = bn.match(/^(.*?)\s*[\(\[（［]\s*([A-Za-z][^()\[\]{}（）［］｛｝]*[A-Za-z0-9.])\s*[\)\]）］]\s*$/u);
  if (!match) return titles;

  const nextBn = cleanText(match[1]);
  const nextEn = cleanText(match[2]);
  if (!nextBn || !nextEn || hasBanglaScript(nextEn)) return titles;

  return {
    bn: nextBn,
    en: nextEn
  };
}

function stripTrailingMetadataNoise(value) {
  let text = stripDanglingTitleBrackets(value);
  if (!text) return null;

  const noisePatterns = [
    /\s+\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},\s+\d{4}\s*$/iu,
    /\s+\b(?:scan|updated|fainal|final|wps\s+office|deep\s+seek)\b\s*$/iu,
    /\s*\.(?:docx?|pdf|epub|mobi)\s*$/iu,
    /\s+\bby\s+.+$/iu
  ];

  for (const pattern of noisePatterns) {
    const next = cleanText(text.replace(pattern, ""));
    if (next && next !== text) text = next;
  }

  return stripDanglingTitleBrackets(text);
}

function titleCanSafelyLoseTrailingAuthor(value) {
  const text = cleanText(value);
  if (!text) return false;
  if (text.length < 3) return false;
  return /[\p{Letter}\p{Number}]/u.test(text);
}

function splitBrokenLatinParentheticalTitle(titles) {
  const bn = cleanText(titles.bn);
  const en = cleanText(titles.en);
  if (!bn || !en) return titles;
  if (!/^[A-Za-z][\s\S]*[\(\[（［]\s*$/u.test(en)) return titles;

  const bnMatch = bn.match(/^([^\)\]）］]+)[\)\]）］]/u);
  if (!bnMatch) return titles;

  const nextBn = stripDanglingTitleBrackets(bnMatch[1]);
  const nextEn = stripDanglingTitleBrackets(en);
  if (!nextBn || !nextEn || !hasBanglaScript(nextBn) || hasBanglaScript(nextEn)) return titles;

  return {
    bn: nextBn,
    en: nextEn
  };
}

function isLatinTitleNoise(value) {
  const text = cleanText(value);
  if (!text) return true;
  if (/^(?:html|iau|updated|scan|fainal|final|wps\s+office|deep\s+seek|pc\s+version|mobile\s+phone\s+version)$/iu.test(text)) {
    return true;
  }
  if (/^(?:\d+(?:st|nd|rd|th)?\s+)?bcs$/iu.test(text)) return true;
  if (/^\.(?:docx?|pdf|epub|mobi)$/iu.test(text)) return true;
  return false;
}

function latinTitleWithoutAuthor(value, authorNames) {
  let text = stripTrailingMetadataNoise(value);
  if (!text) return null;

  text = cleanText(text.replace(/\s+\bby\s+.+$/iu, ""));
  for (const authorName of authorNameVariants(authorNames)) {
    const name = cleanText(authorName);
    if (!name || hasBanglaScript(name)) continue;
    const escapedName = escapeRegExp(name);
    const next = cleanText(text.replace(new RegExp(`(?:\\s*[,،;|]\\s*|\\s*[-–—_]?\\s*)${escapedName}\\.?\\s*$`, "iu"), ""));
    if (next && next !== text) text = next;
  }

  return stripDanglingTitleBrackets(text);
}

function splitBanglaLatinTitle(titles, authors) {
  const rawBn = cleanText(titles.bn);
  const en = cleanText(titles.en);
  if (!rawBn || (en && hasUsefulEnglishTitleCue(en)) || !hasBanglaScript(rawBn) || !hasLatinScript(rawBn)) return titles;

  const authorNames = authors.flatMap((author) => [author.name_bn, author.name_en]).filter(Boolean);
  const cleanedBn = stripTrailingMetadataNoise(rawBn);
  if (cleanedBn && cleanedBn !== rawBn && !hasLatinScript(cleanedBn)) {
    return {
      bn: cleanedBn,
      en: null
    };
  }

  const bn = cleanedBn || rawBn;
  const yearAuthorRomanized = bn.match(
    /^(.+?[\u0980-\u09FF])\s*[-–—]\s*\d{3,4}\s*[-–—]\s*.+?\s*[-–—]\s*([\p{Script=Latin}\p{Mark}][\p{Script=Latin}\p{Mark}0-9 .,'’&:_-]+)$/u
  );
  if (yearAuthorRomanized) {
    const nextBn = stripDanglingTitleBrackets(yearAuthorRomanized[1]);
    const nextEn = latinTitleWithoutAuthor(yearAuthorRomanized[2], authorNames);
    if (nextBn && nextEn && !hasBanglaScript(nextEn) && !isLatinTitleNoise(nextEn)) {
      return {
        bn: nextBn,
        en: nextEn
      };
    }
  }

  const quotedEnglish = bn.match(/^(.+?[\u0980-\u09FF])\s+["“]([^"”]*[\p{Script=Latin}][^"”]*)["”]\s*$/u);
  if (quotedEnglish) {
    const nextBn = stripDanglingTitleBrackets(quotedEnglish[1]);
    const nextEn = latinTitleWithoutAuthor(quotedEnglish[2], authorNames);
    if (nextBn && nextEn && !hasBanglaScript(nextEn) && !isLatinTitleNoise(nextEn)) {
      return {
        bn: nextBn,
        en: nextEn
      };
    }
  }

  const latinMiddleBanglaTail = bn.match(
    /^(.+?[\u0980-\u09FF])\s+([\p{Script=Latin}\p{Mark}][\p{Script=Latin}\p{Mark}0-9 .,'’&:_-]+)\s+([\u0980-\u09FF০-৯\d\s().।-]+)$/u
  );
  if (latinMiddleBanglaTail) {
    const firstBn = stripDanglingTitleBrackets(latinMiddleBanglaTail[1]);
    const tailBn = stripDanglingTitleBrackets(latinMiddleBanglaTail[3]);
    const nextEn = latinTitleWithoutAuthor(latinMiddleBanglaTail[2], authorNames);
    const nextBn = cleanText([firstBn, tailBn].filter(Boolean).join(" "));
    if (nextBn && nextEn && !hasLatinScript(nextBn) && !hasBanglaScript(nextEn) && !isLatinTitleNoise(nextEn)) {
      return {
        bn: nextBn,
        en: nextEn
      };
    }
  }

  const duplicateBangla = bn.match(/^(.+?[\u0980-\u09FF])\s+([\p{Script=Latin}\p{Mark}][^,،;|]+)\s*[,،;|]\s*(.+[\u0980-\u09FF])$/u);
  if (duplicateBangla) {
    const firstBn = cleanText(duplicateBangla[1]);
    const secondBn = cleanText(duplicateBangla[3]);
    const latin = latinTitleWithoutAuthor(duplicateBangla[2], authorNames);
    if (firstBn && secondBn && normalizedTextKey(firstBn) === normalizedTextKey(secondBn) && latin && !isLatinTitleNoise(latin)) {
      return {
        bn: firstBn,
        en: latin
      };
    }
  }

  const delimited = bn.match(/^(.+?[\u0980-\u09FF])\s*(?:=|[:：]|[-–—]\s+|,\s*)\s*([\p{Script=Latin}\p{Mark}][\s\S]+)$/u);
  if (delimited) {
    const nextBn = stripDanglingTitleBrackets(delimited[1]);
    const nextEn = latinTitleWithoutAuthor(delimited[2], authorNames);
    if (nextBn && nextEn && !hasBanglaScript(nextEn) && !isLatinTitleNoise(nextEn)) {
      return {
        bn: nextBn,
        en: nextEn
      };
    }
  }

  const trailingLatin = bn.match(/^(.+[\u0980-\u09FF][^A-Za-z]*)\s+([\p{Script=Latin}\p{Mark}][\p{Script=Latin}\p{Mark}0-9 .,'’&:_-]+)$/u);
  if (trailingLatin) {
    const nextBn = stripDanglingTitleBrackets(trailingLatin[1]);
    const nextEn = latinTitleWithoutAuthor(trailingLatin[2], authorNames);
    if (nextBn && nextEn && !hasBanglaScript(nextEn) && !isLatinTitleNoise(nextEn)) {
      return {
        bn: nextBn,
        en: nextEn
      };
    }

    if (nextBn && nextEn && isLatinTitleNoise(nextEn)) {
      return {
        bn: nextBn,
        en: null
      };
    }
  }

  return titles;
}

function sourceRecordsForWork(work) {
  if (!work) return [];
  return (work.source_refs || []).map((sourceRef) => sourcesById.get(sourceRef)).filter(Boolean);
}

function hasOnlyArchiveSources(work) {
  const sourceRecords = sourceRecordsForWork(work);
  return sourceRecords.length > 0 && sourceRecords.every((source) => source.source === "Internet Archive");
}

function mergeHiddenAliases(titles, aliases) {
  return {
    ...titles,
    hidden_aliases: Array.from(new Set([...(titles.hidden_aliases || []), ...aliases.map(stripTrailingTitleSeparators).filter(isUsefulAlias)]))
  };
}

function archiveOnlyCleanBanglaTitle(titles, work) {
  if (!hasOnlyArchiveSources(work)) return titles;

  let bn = cleanText(titles.bn);
  if (!bn || !hasBanglaScript(bn)) return titles;

  const hiddenAliases = [];
  bn = bn.replace(/\s*[\(\[（［]\s*((?:bangla|bengali)\s+detailed\s+version|bangla|bengali|pc\s+version|mobile\s+phone\s+version)\s*[\)\]）］]\s*/giu, (_match, alias) => {
    hiddenAliases.push(alias);
    return " ";
  });

  bn = bn.replace(/\s+(?:A\s+Non\s+Profit\s+)?ভুঁইফোঁড়\s+Initiative\b/iu, "");
  bn = bn.replace(/যুলহvজ্জ্ব/gu, "যুলহিজ্জ্ব");

  const trailingLatin = cleanText(bn)?.match(/^(.+[\u0980-\u09FF][^A-Za-z]*)\s+([\p{Script=Latin}\p{Mark}][\p{Script=Latin}\p{Mark}0-9 .,'’&:_~/-]+)$/u);
  if (trailingLatin) {
    bn = trailingLatin[1];
    hiddenAliases.push(trailingLatin[2]);
  }

  const trailingCredit = cleanText(bn)?.match(/^(.+[\u0980-\u09FF])\s*[-–—]\s*([\u0980-\u09FF][\u0980-\u09FF\s.'’]+)$/u);
  if (trailingCredit) {
    const tail = cleanText(trailingCredit[2]);
    const tailWords = tail ? tail.split(/\s+/u).length : 0;
    const looksLikeCredit = tailWords > 0 && tailWords <= 5 && !/(?:খণ্ড|ভাগ|পর্ব|সংখ্যা|অধ্যায়|অধ্যায়|দিন|রাত্রি|পত্র|প্রবন্ধ|গল্প|কবিতা)/u.test(tail);
    if (looksLikeCredit) {
      bn = trailingCredit[1];
      hiddenAliases.push(tail);
    }
  }

  return mergeHiddenAliases(
    {
      ...titles,
      bn: stripDanglingTitleBrackets(bn)
    },
    hiddenAliases
  );
}

function hasUsefulEnglishTitleCue(value) {
  const text = cleanText(value);
  if (!text) return false;
  if (/(?:^|[\s/])[\p{Letter}\p{Number}-]+(?:\.[\p{Letter}\p{Number}-]+)+(?:[\s/:?#]|$)/iu.test(text)) return false;
  if (/^(?:bengali|bangla|script of|pc version|mobile phone version)$/iu.test(text)) return false;
  if (/^book\s+[A-Za-z][A-Za-z .,'’&:_-]+$/iu.test(text)) return false;
  if (/\b(?:manual|guide|history|historical|became|comics|story|stories|poet|poems?|poetry|music|classes|english|translation|translated|outline|realm|absurd|sound|scripts|calendar|astronomy|physics|electricity|homeopathic|clinical|therapeutics|ordinance|constitution|biography|autobiography|memoirs?|dictionary|science|security|family|community|election|rights|islam|muslim|ummah|systems?|methods?|genocide|engineer|bangladesh|asia|civil|counseling|city|town|village|country|region|bengal|language|grammar|yellow|devil|memories|liberation|war|peace|pantry|sun|moon|silence|lambs|unfinished|trap|flowers|flame|eye|tiger|murder|vicarage|mirror|cracked|side|hill|tracts|retrospect|prospect|ant|cosmonaut|bears|thoughts|origin|development|movement|unity|indian|blissful|hell|love|youths?|moments|truth|dhaka|vocabulary|reading|practice|novel|selected|collected|complete|works|adventures?|secret|mystery|case|life|death|world|earth|sky|sea|river|night|days?|house|home|letters?|father|mother|girl|boy|man|woman|first|last|great|little|black|white|red|blue|green|golden|dark|light|return|journey|travels?|diary|politics|political|revolution|freedom)\b/i.test(text)) {
    return true;
  }
  return false;
}

function suppressTransliterationSubtitle(titles) {
  const bn = cleanText(titles.bn);
  const en = cleanText(titles.en);
  if (!bn || !en || !hasBanglaScript(bn) || !hasLatinScript(en)) return titles;
  if (hasBanglaScript(en)) return titles;
  if (hasUsefulEnglishTitleCue(en)) return titles;

  return mergeHiddenAliases({
    ...titles,
    bn,
    en: null
  }, [en]);
}

function suppressArchiveOnlySubtitle(titles, work) {
  const en = cleanText(titles.en);
  if (!en || !hasOnlyArchiveSources(work)) return titles;

  return mergeHiddenAliases(
    {
      ...titles,
      en: null
    },
    [en]
  );
}

function isUsefulAlias(value) {
  const text = stripTrailingTitleSeparators(value);
  if (!text) return false;
  if (/^(?:bengali|bangla|bangla detailed version|pc version|mobile phone version|script of)$/iu.test(text)) return false;
  if (/(?:^|[\s/])[\p{Letter}\p{Number}-]+(?:\.[\p{Letter}\p{Number}-]+)+(?:[\s/:?#]|$)/iu.test(text)) return false;
  return true;
}

function cleanLeadingTitleSeparators(titles) {
  const bn = cleanText(titles.bn);
  const cleanedBn = stripLeadingBanglaTitleSeparators(bn);
  if (!bn || !cleanedBn || cleanedBn === bn) return titles;

  return mergeHiddenAliases(
    {
      ...titles,
      bn: cleanedBn
    },
    [bn]
  );
}

function cleanExportTitles(titles, authors, work) {
  const splitTitles = splitBanglaLatinTitle(splitTrailingLatinParentheticalTitle(splitBrokenLatinParentheticalTitle(titles)), authors);
  const authorCleaned = removeTrailingAuthorsFromTitles(splitTitles, authors);
  const archiveTitleCleaned = archiveOnlyCleanBanglaTitle(authorCleaned, work);
  const leadingCleaned = cleanLeadingTitleSeparators(archiveTitleCleaned);
  return suppressArchiveOnlySubtitle(suppressTransliterationSubtitle(leadingCleaned), work);
}

function isSourceLikeNonAuthor(value) {
  const text = cleanText(value)?.replace(/^[-–—\s]+|[-–—\s]+$/gu, "");
  if (!text) return true;
  if (/^(?:creator|editor|anonymous|unknown(?:\s*\d+)?|not available|n\/a|na|none|null)$/i.test(text)) return true;
  if (/(?:https?:\/\/|www\.|@)/i.test(text)) return true;
  if (/(?:^|[\s/])[\p{Letter}\p{Number}-]+(?:\.[\p{Letter}\p{Number}-]+)+(?:[\s/:?#]|$)/iu.test(text)) {
    return true;
  }
  return /\b(?:archive|blogspot|collection|educarion|education|genid|internet archive|professors?\s+bcs|scanner|school|unmochon|uploaded by|uploader|weebly|wikidata\.org|wordpress)\b|(?:শিক্ষা\s*পরিবার)/iu.test(text);
}

function isUsableAuthor(author) {
  return author && !isSourceLikeNonAuthor(author.name_bn || author.name_en);
}

function archivePackagingSignal(value) {
  const text = cleanText(value);
  if (!text) return false;
  if (/^\p{Decimal_Number}+[.)।]*$/u.test(text)) return true;
  if (/\p{Decimal_Number}{1,2}[./-]\p{Decimal_Number}{1,2}[./-]\p{Decimal_Number}{2,4}/u.test(text)) return true;
  return /\.(?:pdf|epub|mobi)\b|(?:বইঃ|ডাউনলোড|নন-প্রফিট|পিডিএফ|প্রকাশকঃ|লেখক\s*\/\s*অনুবাদক|শিক্ষা\s*পরিবার)|\b(?:compressed|download|educarion|education|high[-\s]?quality|media|pdf|school|team|unmochon)\b/iu.test(text);
}

function archiveMultiscriptNoiseSignal(value) {
  const text = cleanText(value);
  if (!text || !hasBanglaScript(text) || !hasLatinScript(text)) return false;
  return /[\u0600-\u06FF\u0900-\u097F]/u.test(text);
}

function archiveResearchStatus(source) {
  const match = String(source?.notes || "").match(/Archive candidate research:\s*([a-z_]+)/i);
  return match?.[1] || null;
}

function candidateResearchStatus(source) {
  const match = String(source?.notes || "").match(/Candidate source research:\s*([a-z_]+)/i);
  return match?.[1] || null;
}

function needsArchiveVerification(work) {
  const sourceRecords = (work.source_refs || []).map((sourceRef) => sourcesById.get(sourceRef)).filter(Boolean);
  const archiveSources = sourceRecords.filter((source) => source.source === "Internet Archive");
  if (!archiveSources.length) return false;
  if (sourceRecords.some((source) => source.source !== "Internet Archive")) return false;
  if (archiveSources.every((source) => archiveResearchStatus(source) === "verified_book")) return false;
  return archiveSources.some(
    (source) => archivePackagingSignal(source.raw_title) || archivePackagingSignal(source.raw_author) || archiveMultiscriptNoiseSignal(source.raw_title)
  );
}

function hasContributedAuthor(work) {
  return (contributionsByWork.get(work.id) || []).some((contribution) =>
    isUsableAuthor(authorsById.get(contribution.author_id))
  );
}

function normalizeAuthorForExport(author, contribution) {
  const names = normalizeLocalizedPair(author?.name_bn, author?.name_en);
  return {
    id: contribution.id,
    name_bn: cleanPersonName(names.bn),
    name_en: cleanPersonName(names.en),
    role: contribution.role,
    source_refs: contribution.source_refs
  };
}

function dedupeExportAuthors(authors) {
  const authorsByName = new Map();
  for (const author of authors) {
    if (!isUsableAuthor(author)) continue;
    const authorKey =
      normalizedTextKey(`${author.name_bn || ""}|${author.name_en || ""}|${author.role || "author"}`) ||
      `${author.id}|${author.role || "author"}`;
    const previous = authorsByName.get(authorKey);
    authorsByName.set(authorKey, {
      ...author,
      id: previous?.id || author.id,
      source_refs: Array.from(new Set([...(previous?.source_refs || []), ...(author.source_refs || [])]))
    });
  }
  return Array.from(authorsByName.values());
}

function normalizeCandidateForExport(candidate) {
  const titles = normalizeLocalizedPair(candidate.title_bn, candidate.title_en);
  return {
    ...candidate,
    title_bn: titles.bn,
    title_en: titles.en,
    authors: (candidate.authors || []).map((author) => {
      const names = normalizeLocalizedPair(author.name_bn, author.name_en);
      return {
        id: author.id,
        name_bn: names.bn,
        name_en: names.en,
        role: author.role
      };
    })
  };
}

fs.mkdirSync(exportsDir, { recursive: true });

const sources = readJsonl(path.join(mainDir, "source_records.jsonl"));
const authors = readJsonl(path.join(mainDir, "authors.jsonl"));
const works = readJsonl(path.join(mainDir, "works.jsonl"));
const editions = readJsonl(path.join(mainDir, "editions.jsonl"));
const contributions = readJsonl(path.join(mainDir, "contributions.jsonl"));
const candidateBooks = readJsonl(generated.candidateBooks);

const sourcesById = new Map(sources.map((source) => [source.id, source]));
const authorsById = new Map(authors.map((author) => [author.id, author]));
const usableAuthorIds = new Set(authors.filter((author) => isUsableAuthor(author)).map((author) => author.id));
const editionsByWork = new Map();
const contributionsByWork = new Map();
const contributionsByAuthor = new Map();

for (const edition of editions) {
  const list = editionsByWork.get(edition.work_id) || [];
  list.push(edition);
  editionsByWork.set(edition.work_id, list);
}

for (const contribution of contributions) {
  const workList = contributionsByWork.get(contribution.work_id) || [];
  workList.push(contribution);
  contributionsByWork.set(contribution.work_id, workList);

  const authorList = contributionsByAuthor.get(contribution.author_id) || [];
  authorList.push(contribution);
  contributionsByAuthor.set(contribution.author_id, authorList);
}

function isSingleArchiveSourceWork(work) {
  const sourceRecords = (work.source_refs || []).map((sourceRef) => sourcesById.get(sourceRef)).filter(Boolean);
  return sourceRecords.length === 1 && sourceRecords[0].source === "Internet Archive";
}

function isRejectedSourceCandidate(work) {
  const sourceRecords = (work.source_refs || []).map((sourceRef) => sourcesById.get(sourceRef)).filter(Boolean);
  if (!sourceRecords.length) return false;
  const statuses = sourceRecords.map(candidateResearchStatus).filter(Boolean);
  return statuses.length > 0 && statuses.every((status) => status === "not_book" || status === "not_bangla_book");
}

const workExport = works
  .filter(
    (work) =>
      isBanglaLanguageWork(work) &&
      hasContributedAuthor(work) &&
      !needsArchiveVerification(work) &&
      !isSingleArchiveSourceWork(work) &&
      !isRejectedSourceCandidate(work)
  )
  .map((work) => {
    const titles = normalizeLocalizedPair(work.title_bn, work.title_en);
    const workContributions = contributionsByWork.get(work.id) || [];
    const authorsByRole = new Map();
    for (const contribution of workContributions) {
      const key = `${contribution.author_id}|${contribution.role}`;
      const previous = authorsByRole.get(key);
      authorsByRole.set(key, {
        id: contribution.author_id,
        role: contribution.role,
        source_refs: Array.from(new Set([...(previous?.source_refs || []), ...(contribution.source_refs || [])]))
      });
    }
    const exportAuthors = dedupeExportAuthors(
      Array.from(authorsByRole.values()).map((contribution) =>
        normalizeAuthorForExport(authorsById.get(contribution.id), contribution)
      )
    );
    const cleanedTitles = cleanExportTitles(titles, exportAuthors, work);
    const aliases = Array.from(
      new Set([...(work.aliases || []), cleanedTitles.hidden_en_alias, ...(cleanedTitles.hidden_aliases || [])].map(stripTrailingTitleSeparators).filter(isUsefulAlias))
    );

    return {
      ...work,
      title_bn: cleanedTitles.bn,
      title_en: cleanedTitles.en,
      aliases,
      source_count: work.source_refs.length,
      edition_source_refs: Array.from(
        new Set((editionsByWork.get(work.id) || []).flatMap((edition) => edition.source_refs || []))
      ),
      authors: exportAuthors,
      edition_count: (editionsByWork.get(work.id) || []).length
    };
  })
  .sort((a, b) => (a.title_bn || a.title_en || a.id).localeCompare(b.title_bn || b.title_en || b.id));

const authorExport = authors
  .filter((author) => usableAuthorIds.has(author.id))
  .map((author) => {
    const names = normalizeLocalizedPair(author.name_bn, author.name_en);
    return {
      ...author,
      name_bn: cleanPersonName(names.bn),
      name_en: cleanPersonName(names.en),
      contribution_count: (contributionsByAuthor.get(author.id) || []).length
    };
  })
  .sort((a, b) => (a.name_bn || a.name_en || a.id).localeCompare(b.name_bn || b.name_en || b.id));

const candidateBookExport = candidateBooks.map(normalizeCandidateForExport);

const summary = {
  format_version: 1,
  counts: {
    source_records: sources.length,
    authors: authors.length,
    works: works.length,
    editions: editions.length,
    contributions: contributions.length
  }
};

writeOrCheck("candidate-books.json", candidateBookExport);
writePagedBookExport({ name: "works", rows: workExport, pageSize: WORKS_PAGE_SIZE, includeReferences: true });
writePagedBookExport({ name: "candidate-books", rows: candidateBookExport, pageSize: WORKS_PAGE_SIZE, includeReferences: false });
writePagedRecordExport({ name: "references", rows: sources, pageSize: REFERENCES_PAGE_SIZE });
removeStaleRootExport("authors.json");
removeStaleRootExport("works.json");
removeStaleRootExport("editions.json");
removeStaleRootExport("contributions.json");
removeStaleRootExport("references.json");
writeOrCheck("dataset-summary.json", summary);

if (checkMode) {
  if (process.exitCode) {
    console.error("Dataset exports need to be regenerated with pnpm dataset:export.");
    process.exit(process.exitCode);
  }
  console.log("Generated exports are up to date.");
} else {
  console.log("Generated dataset exports.");
  console.log(stableJson(summary));
}
