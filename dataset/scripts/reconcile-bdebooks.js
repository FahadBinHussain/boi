const fs = require("node:fs");
const path = require("node:path");
const { archiveDir, tables } = require("./paths");
const { readJsonl } = require("./jsonl-store");

const requestedRunId = process.env.BDEBOOKS_RUN_ID || null;
const checkId = process.env.BDEBOOKS_RECONCILE_ID || new Date().toISOString().replace(/[:.]/g, "-");
const limit = Number(process.env.BDEBOOKS_RECONCILE_LIMIT || 0);

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
  const text = String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
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

const titleStopWords = new Set([
  "a",
  "an",
  "and",
  "by",
  "ebook",
  "ebooks",
  "pdf",
  "the",
  "o"
]);

const authorStopWords = new Set(["dr", "md", "mohd", "maulana", "sri", "shri", "prof"]);

function tokens(value, stopWords = titleStopWords) {
  const normalized = key(value);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function keyTokens(value) {
  const normalized = key(value);
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
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
    ?.replace(/\b(?:ed|edition|vol|volume|part|khanda|khondo|khanda|book)\b/g, " ")
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

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function latestBdebooksRunDir() {
  const root = path.join(archiveDir, "bdebooks");
  if (!fs.existsSync(root)) throw new Error(`No BDeBooks archive directory found: ${root}`);
  const runs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, "books.jsonl")))
    .map((entry) => ({
      name: entry.name,
      dir: path.join(root, entry.name),
      mtime: fs.statSync(path.join(root, entry.name, "books.jsonl")).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!runs.length) throw new Error(`No BDeBooks books.jsonl run found in ${root}`);
  return runs[0];
}

function selectedRun() {
  if (!requestedRunId) return latestBdebooksRunDir();
  const dir = path.join(archiveDir, "bdebooks", requestedRunId);
  const filePath = path.join(dir, "books.jsonl");
  if (!fs.existsSync(filePath)) throw new Error(`BDeBooks run has no books.jsonl: ${filePath}`);
  return { name: requestedRunId, dir };
}

function buildMainIndex() {
  const authors = readJsonl(tables.authors);
  const works = readJsonl(tables.works);
  const contributions = readJsonl(tables.contributions);

  const authorsById = new Map(authors.map((author) => [author.id, author]));
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
    authorsById,
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

function bdeAuthorNames(record) {
  return unique((record.authors || []).map((author) => cleanText(author.name)));
}

function bdeAuthorKeys(record) {
  return unique(bdeAuthorNames(record).map(key));
}

function bestAuthorScore(recordAuthorNames, work) {
  if (!recordAuthorNames.length || !work.author_keys.length) return 0;
  let best = 0;
  for (const recordAuthor of recordAuthorNames) {
    for (const workAuthorKey of work.author_keys) {
      best = Math.max(best, similarity(recordAuthor, workAuthorKey, authorStopWords));
    }
  }
  return best;
}

function bestTitleScore(recordTitle, work) {
  if (!recordTitle || !work.title_values.length) return 0;
  let best = 0;
  for (const title of work.title_values) {
    const score = hasNumberConflict(recordTitle, title) ? Math.min(similarity(recordTitle, title), 0.6) : similarity(recordTitle, title);
    best = Math.max(best, score);
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
  const exactTitleKey = key(record.title);
  const looseKey = looseTitleKey(record.title);

  for (const id of index.titleKeyToWorkIds.get(exactTitleKey) || []) ids.add(id);
  for (const id of index.looseTitleKeyToWorkIds.get(looseKey) || []) ids.add(id);
  for (const authorKey of bdeAuthorKeys(record)) {
    for (const id of index.authorKeyToWorkIds.get(authorKey) || []) ids.add(id);
  }

  const titleTokens = tokens(record.title)
    .filter((token) => token.length >= 4)
    .map((token) => ({ token, frequency: (index.tokenToWorkIds.get(token) || []).length }))
    .filter((entry) => entry.frequency > 0 && entry.frequency <= 1200)
    .sort((a, b) => a.frequency - b.frequency)
    .slice(0, 4);

  for (const { token } of titleTokens) {
    for (const id of index.tokenToWorkIds.get(token) || []) ids.add(id);
  }

  return Array.from(ids);
}

function classifyRecord(record, index) {
  const recordTitle = cleanText(record.title);
  const recordAuthors = bdeAuthorNames(record);
  const recordAuthorKeys = bdeAuthorKeys(record);
  const exactTitleKey = key(recordTitle);
  const exactTitleIds = index.titleKeyToWorkIds.get(exactTitleKey) || [];
  const exactAuthorIds = new Set(recordAuthorKeys.flatMap((authorKey) => index.authorIdsByKey.get(authorKey) || []));

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
    const titleScore = bestTitleScore(recordTitle, work);
    const authorScore = bestAuthorScore(recordAuthors, work);
    const totalScore = Math.round((titleScore * 0.7 + authorScore * 0.3) * 1000) / 1000;
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
      matches: exactTitleOnly.map((work) =>
        compactWork(work, {
          title_score: 1,
          author_score: bestAuthorScore(recordAuthors, work)
        })
      )
    };
  }

  if (best && best.title_score >= 0.88 && best.author_score >= 0.78) {
    return {
      status: "likely_duplicate",
      matches: [compactWork(best.work, best)]
    };
  }

  if (best && ((best.title_score >= 0.72 && best.author_score >= 0.72) || (best.title_score >= 0.92 && best.author_score >= 0.4))) {
    return {
      status: "possible_match",
      matches: [compactBestMatch(best)]
    };
  }

  if (!recordTitle || !recordAuthors.length || record.flags?.no_usable_author) {
    return {
      status: "manual_review",
      reason: !recordTitle ? "missing title" : "missing or unusable author",
      matches: hasReviewableBestMatch(best) ? [compactBestMatch(best)] : []
    };
  }

  return {
    status: "not_found_in_main",
    matches: hasReviewableBestMatch(best) ? [compactBestMatch(best)] : []
  };
}

function reportRow(record, classification) {
  return {
    source_id: record.source_id,
    title: record.title,
    raw_title: record.raw_title,
    authors: bdeAuthorNames(record),
    url: record.url,
    genres: (record.genres || []).map((genre) => genre.name).filter(Boolean),
    flags: record.flags || {},
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
    source: "BDeBooks",
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
      exact_matches: "safe existing-main matches for enrichment, not new works",
      title_only_matches: "same title exists but author needs review",
      likely_duplicates: "probable duplicates; do not promote without review",
      possible_matches: "weak to medium local match; needs source review",
      not_found_in_main: "not found locally; needs external/source research before promotion",
      manual_review: "insufficient title or author metadata"
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
