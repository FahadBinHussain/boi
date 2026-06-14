const fs = require("node:fs");
const path = require("node:path");
const { archiveDir, tables } = require("./paths");
const { readJsonl } = require("./jsonl-store");

const sourceName = "BanglaBook.org";
const sourceSlug = "banglabook-org";
const requestedRunId = process.env.BANGLABOOK_ORG_RUN_ID || null;
const checkId = process.env.BANGLABOOK_ORG_RECONCILE_ID || new Date().toISOString().replace(/[:.]/g, "-");
const limit = Number(process.env.BANGLABOOK_ORG_RECONCILE_LIMIT || 0);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(filePath, rows) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s'",]+|[\s'",]+$/g, "")
    .trim();
  return text || null;
}

function unique(values) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function hasBangla(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function key(value) {
  return cleanText(value)
    ?.toLowerCase()
    .normalize("NFKC")
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const titleStopWords = new Set(["a", "an", "and", "bangla", "bengali", "book", "boi", "by", "ebook", "ebooks", "pdf", "the", "o"]);
const authorStopWords = new Set(["dr", "md", "mohd", "maulana", "prof", "professor", "sri", "shri"]);
const genericAuthorPattern = /\b(?:author|authors|various|various writers?|various author|unknown|compiled|collection)\b/i;

function keyTokens(value) {
  const normalized = key(value);
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

function tokens(value, stopWords = titleStopWords) {
  return keyTokens(value).filter((token) => token.length > 1 && !stopWords.has(token));
}

function containsTokenSequence(haystack, needle) {
  if (!needle.length || needle.length > haystack.length) return false;
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    let matched = true;
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[start + index] !== needle[index]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

function numberTokens(value) {
  return new Set(keyTokens(value).filter((token) => /^\d+$/.test(token)));
}

function hasNumberConflict(a, b) {
  const leftNumbers = numberTokens(a);
  const rightNumbers = numberTokens(b);
  if (!leftNumbers.size || !rightNumbers.size) return false;
  for (const number of leftNumbers) {
    if (rightNumbers.has(number)) return false;
  }
  return true;
}

function tokenSet(value, stopWords) {
  return new Set(tokens(value, stopWords));
}

function diceFromSets(a, b) {
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return (2 * overlap) / (a.size + b.size);
}

function containsScore(a, b) {
  const left = key(a);
  const right = key(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftTokens = keyTokens(left);
  const rightTokens = keyTokens(right);
  if (left.length >= 6 && containsTokenSequence(rightTokens, leftTokens)) return leftTokens.length > 1 ? 0.9 : 0.72;
  if (right.length >= 6 && containsTokenSequence(leftTokens, rightTokens)) return rightTokens.length > 1 ? 0.9 : 0.72;
  return 0;
}

function similarity(a, b, stopWords = titleStopWords) {
  return Math.max(containsScore(a, b), diceFromSets(tokenSet(a, stopWords), tokenSet(b, stopWords)));
}

function looseTitleKey(value) {
  return key(value)
    ?.replace(/\b(?:ed|edition|vol|volume|part|khanda|khondo|book|boi|ebook|ebooks|pdf)\b/g, " ")
    .replace(/\b(?:1st|2nd|3rd|[0-9]+th)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addToMapList(map, mapKey, value) {
  if (!mapKey) return;
  const list = map.get(mapKey) || [];
  list.push(value);
  map.set(mapKey, list);
}

function latestRunDir() {
  const root = path.join(archiveDir, sourceSlug);
  if (!fs.existsSync(root)) throw new Error(`No ${sourceName} archive directory found: ${root}`);
  const runs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, "books.jsonl")))
    .map((entry) => ({
      name: entry.name,
      dir: path.join(root, entry.name),
      mtime: fs.statSync(path.join(root, entry.name, "books.jsonl")).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!runs.length) throw new Error(`No ${sourceName} books.jsonl run found in ${root}`);
  return runs[0];
}

function selectedRun() {
  if (!requestedRunId) return latestRunDir();
  const dir = path.join(archiveDir, sourceSlug, requestedRunId);
  const filePath = path.join(dir, "books.jsonl");
  if (!fs.existsSync(filePath)) throw new Error(`${sourceName} run has no books.jsonl: ${filePath}`);
  return { name: requestedRunId, dir };
}

function buildMainIndex() {
  const authors = readJsonl(tables.authors);
  const works = readJsonl(tables.works);
  const contributions = readJsonl(tables.contributions);

  const authorKeysById = new Map();
  const authorIdsByKey = new Map();
  for (const author of authors) {
    const names = unique([author.name_bn, author.name_en, ...(author.aliases || [])]);
    const keys = unique(names.map(key));
    authorKeysById.set(author.id, keys);
    for (const authorKey of keys) addToMapList(authorIdsByKey, authorKey, author.id);
  }

  const workAuthorIds = new Map();
  for (const contribution of contributions) {
    if (!contribution.work_id || !contribution.author_id) continue;
    const list = workAuthorIds.get(contribution.work_id) || [];
    list.push(contribution.author_id);
    workAuthorIds.set(contribution.work_id, list);
  }

  const workById = new Map();
  const titleKeyToWorkIds = new Map();
  const looseTitleKeyToWorkIds = new Map();
  const tokenToWorkIds = new Map();
  const authorKeyToWorkIds = new Map();

  for (const work of works) {
    const authorIds = unique(workAuthorIds.get(work.id) || []);
    const authorKeys = unique(authorIds.flatMap((authorId) => authorKeysById.get(authorId) || []));
    const titleValues = unique([work.title_bn, work.title_en, ...(work.aliases || [])]);
    const titleKeys = unique(titleValues.map(key));
    const looseKeys = unique(titleValues.map(looseTitleKey));
    const titleTokens = unique(titleValues.flatMap((title) => tokens(title)));

    const indexedWork = {
      ...work,
      author_ids: authorIds,
      author_keys: authorKeys,
      title_values: titleValues,
      title_keys: titleKeys,
      loose_title_keys: looseKeys,
      title_tokens: titleTokens
    };
    workById.set(work.id, indexedWork);

    for (const titleKey of titleKeys) addToMapList(titleKeyToWorkIds, titleKey, work.id);
    for (const looseKey of looseKeys) addToMapList(looseTitleKeyToWorkIds, looseKey, work.id);
    for (const token of titleTokens) addToMapList(tokenToWorkIds, token, work.id);
    for (const authorKey of authorKeys) addToMapList(authorKeyToWorkIds, authorKey, work.id);
  }

  return {
    authors,
    works,
    workById,
    authorIdsByKey,
    titleKeyToWorkIds,
    looseTitleKeyToWorkIds,
    tokenToWorkIds,
    authorKeyToWorkIds
  };
}

function cleanTitle(value) {
  const text = cleanText(value);
  if (!text) return null;
  return cleanText(
    text
      .replace(/\b(?:bangla|bengali)\s+(?:ebook|ebooks|book)\s+pdf\b/gi, " ")
      .replace(/\b(?:ebook|ebooks|book)\s+pdf\b/gi, " ")
      .replace(/\bpdf\b/gi, " ")
      .replace(/\s+by\s+.+$/i, " ")
  );
}

function recordTitleValues(record) {
  return unique([record.title_bn, cleanTitle(record.title), cleanTitle(record.raw_page_title), cleanTitle(record.source_id?.replace(/-/g, " "))]);
}

function isGenericAuthor(value) {
  const text = cleanText(value);
  return !text || genericAuthorPattern.test(text);
}

function recordContributorLabels(record) {
  return unique([isGenericAuthor(record.author) ? null : record.author, isGenericAuthor(record.author_bn) ? null : record.author_bn]);
}

function bestTitleScore(record, work) {
  let best = 0;
  for (const recordTitle of recordTitleValues(record)) {
    for (const title of work.title_values) {
      const score = hasNumberConflict(recordTitle, title) ? Math.min(similarity(recordTitle, title), 0.6) : similarity(recordTitle, title);
      best = Math.max(best, score);
    }
  }
  return best;
}

function bestAuthorScore(recordLabels, work) {
  if (!recordLabels.length || !work.author_keys.length) return 0;
  let best = 0;
  for (const label of recordLabels) {
    for (const workAuthorKey of work.author_keys) {
      best = Math.max(best, similarity(label, workAuthorKey, authorStopWords));
    }
  }
  return best;
}

function compactWork(work, scores = {}) {
  const scoreFields = {};
  for (const field of ["title_score", "author_score", "total_score"]) {
    if (scores[field] !== undefined) scoreFields[field] = scores[field];
  }
  return {
    work_id: work.id,
    title_bn: work.title_bn || null,
    title_en: work.title_en || null,
    author_ids: work.author_ids,
    source_refs: work.source_refs || [],
    confidence: work.confidence || null,
    ...scoreFields
  };
}

function compactBestMatch(best) {
  return best ? compactWork(best.work, best) : null;
}

function hasReviewableBestMatch(best) {
  return best && best.total_score >= 0.45 && best.title_score >= 0.45;
}

function candidateWorkIds(record, index) {
  const ids = new Set();
  for (const title of recordTitleValues(record)) {
    for (const id of index.titleKeyToWorkIds.get(key(title)) || []) ids.add(id);
    for (const id of index.looseTitleKeyToWorkIds.get(looseTitleKey(title)) || []) ids.add(id);

    const titleTokens = tokens(title)
      .filter((token) => token.length >= 4)
      .map((token) => ({ token, frequency: (index.tokenToWorkIds.get(token) || []).length }))
      .filter((entry) => entry.frequency > 0 && entry.frequency <= 1200)
      .sort((a, b) => a.frequency - b.frequency)
      .slice(0, 5);

    for (const { token } of titleTokens) {
      for (const id of index.tokenToWorkIds.get(token) || []) ids.add(id);
    }
  }

  for (const label of recordContributorLabels(record)) {
    for (const id of index.authorKeyToWorkIds.get(key(label)) || []) ids.add(id);
  }

  return Array.from(ids);
}

function classifyRecord(record, index) {
  const titleValues = recordTitleValues(record);
  const contributorLabels = recordContributorLabels(record);
  const exactTitleIds = unique(titleValues.flatMap((title) => index.titleKeyToWorkIds.get(key(title)) || []));
  const exactAuthorIds = new Set(contributorLabels.flatMap((label) => index.authorIdsByKey.get(key(label)) || []));

  const exactMatches = exactTitleIds
    .map((workId) => index.workById.get(workId))
    .filter(Boolean)
    .filter((work) => work.author_ids.some((authorId) => exactAuthorIds.has(authorId)));

  if (exactMatches.length) {
    return {
      status: "exact_title_author_match",
      matches: exactMatches.map((work) => compactWork(work, { title_score: 1, author_score: 1 }))
    };
  }

  const exactTitleOnly = exactTitleIds.map((workId) => index.workById.get(workId)).filter(Boolean);
  const candidates = candidateWorkIds(record, index)
    .map((workId) => index.workById.get(workId))
    .filter(Boolean);

  let best = null;
  for (const work of candidates) {
    const titleScore = bestTitleScore(record, work);
    const authorScore = bestAuthorScore(contributorLabels, work);
    const totalScore = Math.round((titleScore * 0.76 + authorScore * 0.24) * 1000) / 1000;
    const current = {
      work,
      title_score: Math.round(titleScore * 1000) / 1000,
      author_score: Math.round(authorScore * 1000) / 1000,
      total_score: totalScore
    };
    if (!best || current.total_score > best.total_score) best = current;
  }

  if (exactTitleOnly.length) {
    return {
      status: "title_match_author_unconfirmed",
      reason: contributorLabels.length ? null : "BanglaBook.org has no usable contributor label",
      matches: exactTitleOnly.map((work) =>
        compactWork(work, {
          title_score: 1,
          author_score: bestAuthorScore(contributorLabels, work)
        })
      )
    };
  }

  if (best && best.title_score >= 0.9 && best.author_score >= 0.75) {
    return {
      status: "likely_duplicate",
      matches: [compactWork(best.work, best)]
    };
  }

  if (best && ((best.title_score >= 0.82 && best.author_score >= 0.5) || best.title_score >= 0.94)) {
    return {
      status: "possible_match",
      reason: contributorLabels.length ? null : "title-based only; no usable BanglaBook.org contributor",
      matches: [compactBestMatch(best)]
    };
  }

  if (!titleValues.length) {
    return {
      status: "manual_review",
      reason: "missing title",
      matches: hasReviewableBestMatch(best) ? [compactBestMatch(best)] : []
    };
  }

  return {
    status: "not_found_in_main",
    reason: contributorLabels.length ? null : "missing or generic contributor label",
    matches: hasReviewableBestMatch(best) ? [compactBestMatch(best)] : []
  };
}

function reportRow(record, classification) {
  const titleValues = recordTitleValues(record);
  const contributors = recordContributorLabels(record);
  return {
    source_id: record.source_id,
    title: titleValues[0] || cleanTitle(record.title),
    title_bn: cleanText(record.title_bn),
    title_variants: titleValues,
    raw_title: record.raw_page_title,
    source_title: record.title,
    authors: contributors,
    source_author: cleanText(record.author),
    source_author_bn: cleanText(record.author_bn),
    url: record.url,
    categories: record.categories || [],
    tags: record.tags || [],
    pages: record.pages || null,
    pdf_size: record.pdf_size || null,
    cover_url: record.cover_url || null,
    flags: {
      has_bangla_title: titleValues.some(hasBangla),
      generic_author_seen: isGenericAuthor(record.author) && isGenericAuthor(record.author_bn),
      no_usable_author: contributors.length === 0,
      metadata_only: true
    },
    status: classification.status,
    reason: classification.reason || null,
    matches: classification.matches || []
  };
}

function main() {
  const run = selectedRun();
  const sourceFile = path.join(run.dir, "books.jsonl");
  const outDir = path.join(run.dir, "reconciliation", checkId);
  const sourceRecords = readJsonl(sourceFile);
  const records = limit ? sourceRecords.slice(0, limit) : sourceRecords;
  const index = buildMainIndex();

  const buckets = {
    exact_matches: [],
    title_only_matches: [],
    likely_duplicates: [],
    possible_matches: [],
    not_found_in_main: [],
    manual_review: []
  };

  for (const record of records) {
    const classification = classifyRecord(record, index);
    const row = reportRow(record, classification);
    if (classification.status === "exact_title_author_match") buckets.exact_matches.push(row);
    else if (classification.status === "title_match_author_unconfirmed") buckets.title_only_matches.push(row);
    else if (classification.status === "likely_duplicate") buckets.likely_duplicates.push(row);
    else if (classification.status === "possible_match") buckets.possible_matches.push(row);
    else if (classification.status === "manual_review") buckets.manual_review.push(row);
    else buckets.not_found_in_main.push(row);
  }

  const manifest = {
    source: sourceName,
    run_id: run.name,
    checked_at: new Date().toISOString(),
    check_id: checkId,
    source_file: path.relative(archiveDir, sourceFile).replaceAll("\\", "/"),
    compared_against: {
      works: index.works.length,
      authors: index.authors.length
    },
    config: {
      limit: limit || null
    },
    counts: {
      checked: records.length,
      exact_matches: buckets.exact_matches.length,
      title_only_matches: buckets.title_only_matches.length,
      likely_duplicates: buckets.likely_duplicates.length,
      possible_matches: buckets.possible_matches.length,
      not_found_in_main: buckets.not_found_in_main.length,
      manual_review: buckets.manual_review.length
    },
    interpretation: {
      exact_matches: "same title and contributor already exist in main; safe existing-main candidate for possible source-link enrichment",
      title_only_matches: "same title exists but contributor is missing or unconfirmed",
      likely_duplicates: "probable duplicate; do not promote as new",
      possible_matches: "weak to medium local match; needs source review before promotion",
      not_found_in_main: "not found locally; needs external/source research before promotion",
      manual_review: "insufficient metadata"
    },
    output_files: Object.fromEntries(
      Object.keys(buckets).map((name) => [name, path.relative(archiveDir, path.join(outDir, `${name}.jsonl`)).replaceAll("\\", "/")])
    )
  };

  for (const [name, rows] of Object.entries(buckets)) {
    writeJsonl(path.join(outDir, `${name}.jsonl`), rows);
  }
  writeJson(path.join(outDir, "manifest.json"), manifest);
  console.log(JSON.stringify(manifest, null, 2));
}

main();
