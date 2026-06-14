const fs = require("node:fs");
const path = require("node:path");
const { mainDir, candidatesDir, tables } = require("./paths");

const duplicateReviewsPath = path.join(mainDir, "candidate_duplicate_reviews.jsonl");

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

const authorName = argValue("--author");
const apply = process.argv.includes("--apply");
const candidateOverlapOnly = process.argv.includes("--candidate-overlap-only");
const groupWorkIdsValue = argValue("--group-work-ids");
const groupWorkIds = groupWorkIdsValue
  ? groupWorkIdsValue
      .split(",")
      .map((value) => cleanText(value))
      .filter(Boolean)
  : [];

if (!authorName) {
  console.error(
    "Usage: node dataset/scripts/merge-main-duplicate-works-by-author.js --author <name> [--group-work-ids <id,id>] [--apply]"
  );
  process.exit(1);
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
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizedTextKey(value) {
  return (
    cleanText(value)
      ?.toLowerCase()
      .normalize("NFKC")
      .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
      .trim() || null
  );
}

function mergeArrayValues(...arrays) {
  const out = [];
  const seen = new Set();
  for (const values of arrays) {
    for (const value of values || []) {
      if (!value) continue;
      const key = JSON.stringify(value);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

function dedupeContributions(rows) {
  const byIdentity = new Map();
  for (const row of rows) {
    const key = [row.work_id, row.edition_id || "", row.author_id, row.role || "author"].join("|");
    const previous = byIdentity.get(key);
    byIdentity.set(key, {
      ...row,
      id: previous?.id || row.id,
      source_refs: mergeArrayValues(previous?.source_refs, row.source_refs),
      aliases: mergeArrayValues(previous?.aliases, row.aliases),
      confidence: Math.max(previous?.confidence || 0, row.confidence || 0)
    });
  }
  return Array.from(byIdentity.values());
}

function authorKeys(author) {
  return [author?.name_bn, author?.name_en, ...(author?.aliases || [])].map(normalizedTextKey).filter(Boolean);
}

function titleKeys(work) {
  return [work.title_bn, work.title_en, ...(work.aliases || [])].map(normalizedTextKey).filter(Boolean);
}

function candidateTitleKeys(candidate) {
  return [candidate.title_bn, candidate.title_en, ...(candidate.aliases || [])].map(normalizedTextKey).filter(Boolean);
}

function candidateAuthorKeys(candidate) {
  return (candidate.authors || [])
    .filter((author) => (author.role || "author") === "author")
    .flatMap((author) => [author.name_bn, author.name_en])
    .map(normalizedTextKey)
    .filter(Boolean);
}

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(entryPath, predicate);
    return entry.isFile() && predicate(entryPath, entry.name) ? [entryPath] : [];
  });
}

class UnionFind {
  constructor(values) {
    this.parent = new Map(values.map((value) => [value, value]));
  }

  find(value) {
    const parent = this.parent.get(value);
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent.set(value, root);
    return root;
  }

  union(left, right) {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parent.set(rightRoot, leftRoot);
  }
}

let works = readJsonl(tables.works);
let editions = readJsonl(tables.editions);
let contributions = readJsonl(tables.contributions);
let duplicateReviews = readJsonl(duplicateReviewsPath);
const authors = readJsonl(tables.authors);

const authorKey = normalizedTextKey(authorName);
const authorById = new Map(authors.map((author) => [author.id, author]));
const workById = new Map(works.map((work) => [work.id, work]));
const editionsByWork = new Map();
const contributionsByWork = new Map();

for (const edition of editions) {
  if (!editionsByWork.has(edition.work_id)) editionsByWork.set(edition.work_id, []);
  editionsByWork.get(edition.work_id).push(edition);
}

for (const contribution of contributions) {
  if (!contributionsByWork.has(contribution.work_id)) contributionsByWork.set(contribution.work_id, []);
  contributionsByWork.get(contribution.work_id).push(contribution);
}

function workHasAuthor(work) {
  return (contributionsByWork.get(work.id) || []).some((contribution) =>
    authorKeys(authorById.get(contribution.author_id)).includes(authorKey)
  );
}

const scopedWorks = works.filter(workHasAuthor);
const uf = new UnionFind(scopedWorks.map((work) => work.id));
const titleKeyToWorkIds = new Map();

for (const work of scopedWorks) {
  for (const titleKey of titleKeys(work)) {
    if (!titleKeyToWorkIds.has(titleKey)) titleKeyToWorkIds.set(titleKey, []);
    titleKeyToWorkIds.get(titleKey).push(work.id);
  }
}

if (candidateOverlapOnly) {
  const archiveCandidateFiles = walkFiles(path.join(candidatesDir, "archive"), (_filePath, name) => name.endsWith(".jsonl"));
  for (const filePath of archiveCandidateFiles) {
    for (const candidate of readJsonl(filePath)) {
      if (!candidateAuthorKeys(candidate).includes(authorKey)) continue;
      const workIds = new Set();
      for (const titleKey of candidateTitleKeys(candidate)) {
        for (const workId of titleKeyToWorkIds.get(titleKey) || []) workIds.add(workId);
      }
      if (workIds.size < 2) continue;
      const [first, ...rest] = [...workIds].sort();
      for (const workId of rest) uf.union(first, workId);
    }
  }
} else {
  for (const workIds of titleKeyToWorkIds.values()) {
    if (workIds.length < 2) continue;
    const [first, ...rest] = workIds;
    for (const workId of rest) uf.union(first, workId);
  }
}

const groupsByRoot = new Map();
for (const work of scopedWorks) {
  const root = uf.find(work.id);
  if (!groupsByRoot.has(root)) groupsByRoot.set(root, []);
  groupsByRoot.get(root).push(work);
}

let duplicateGroups = [...groupsByRoot.values()]
  .filter((group) => group.length > 1)
  .sort((left, right) => visibleTitle(left[0]).localeCompare(visibleTitle(right[0])));

if (groupWorkIds.length) {
  const requested = new Set(groupWorkIds);
  duplicateGroups = duplicateGroups.filter((group) => {
    const ids = new Set(group.map((work) => work.id));
    return [...requested].every((workId) => ids.has(workId));
  });
}

function visibleTitle(work) {
  return work.title_bn || work.title_en || "";
}

function canonicalScore(work) {
  const sourceScore = (work.source_refs || []).length * 10;
  const editionScore = (editionsByWork.get(work.id) || []).length * 5;
  const contributionScore = (contributionsByWork.get(work.id) || []).length;
  const idScore = work.id.startsWith("work_wikidata_") ? 3 : work.id.startsWith("work_books_com_bd_") ? 2 : 0;
  return sourceScore + editionScore + contributionScore + idScore + (work.confidence || 0);
}

function chooseCanonical(group) {
  return [...group].sort((left, right) => {
    const scoreDelta = canonicalScore(right) - canonicalScore(left);
    if (scoreDelta) return scoreDelta;
    return left.id.localeCompare(right.id);
  })[0];
}

const retarget = new Map();
const mergedGroups = [];

for (const group of duplicateGroups) {
  const canonical = chooseCanonical(group);
  const duplicates = group.filter((work) => work.id !== canonical.id);
  const years = group.map((work) => work.first_published_year).filter((year) => Number.isInteger(year));

  canonical.source_refs = mergeArrayValues(canonical.source_refs, ...duplicates.map((work) => work.source_refs));
  canonical.aliases = mergeArrayValues(
    canonical.aliases,
    ...duplicates.map((work) => work.aliases),
    duplicates.flatMap((work) => [work.title_bn, work.title_en].filter((title) => title && title !== canonical.title_bn && title !== canonical.title_en))
  );
  canonical.confidence = Math.max(canonical.confidence || 0, ...duplicates.map((work) => work.confidence || 0));
  if (!canonical.title_bn) canonical.title_bn = duplicates.find((work) => work.title_bn)?.title_bn || canonical.title_bn;
  if (!canonical.title_en) canonical.title_en = duplicates.find((work) => work.title_en)?.title_en || canonical.title_en;
  if (years.length) canonical.first_published_year = canonical.first_published_year || Math.min(...years);
  if (!canonical.genre) canonical.genre = duplicates.find((work) => work.genre)?.genre || canonical.genre;

  for (const duplicate of duplicates) retarget.set(duplicate.id, canonical.id);

  mergedGroups.push({
    title: visibleTitle(canonical),
    canonical_work_id: canonical.id,
    removed_work_ids: duplicates.map((work) => work.id)
  });
}

if (retarget.size) {
  works = works.filter((work) => !retarget.has(work.id));
  editions = editions.map((edition) =>
    retarget.has(edition.work_id) ? { ...edition, work_id: retarget.get(edition.work_id) } : edition
  );
  contributions = contributions.map((contribution) =>
    retarget.has(contribution.work_id) ? { ...contribution, work_id: retarget.get(contribution.work_id) } : contribution
  );
  contributions = dedupeContributions(contributions);
  duplicateReviews = duplicateReviews.map((review) => ({
    ...review,
    duplicate_of_work_ids: mergeArrayValues((review.duplicate_of_work_ids || []).map((workId) => retarget.get(workId) || workId))
  }));
}

const summary = {
  author: authorName,
  candidate_overlap_only: candidateOverlapOnly,
  group_work_ids: groupWorkIds,
  duplicate_groups_seen: duplicateGroups.length,
  removed_work_rows: retarget.size,
  dry_run: !apply
};

console.log(JSON.stringify(summary, null, 2));
if (mergedGroups.length) {
  console.log("Merged groups:");
  for (const group of mergedGroups.slice(0, 80)) {
    console.log(`- ${group.title}: ${group.removed_work_ids.join(", ")} -> ${group.canonical_work_id}`);
  }
  if (mergedGroups.length > 80) console.log(`... ${mergedGroups.length - 80} more`);
}

if (apply) {
  writeJsonl(tables.works, works);
  writeJsonl(tables.editions, editions);
  writeJsonl(tables.contributions, contributions);
  writeJsonl(duplicateReviewsPath, duplicateReviews);
}
