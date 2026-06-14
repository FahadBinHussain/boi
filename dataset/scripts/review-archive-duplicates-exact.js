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

const apply = process.argv.includes("--apply");
const limitValue = argValue("--limit");
const limit = limitValue ? Number.parseInt(limitValue, 10) : null;

if (limitValue && (!Number.isInteger(limit) || limit < 1)) {
  throw new Error("--limit must be a positive integer");
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

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(entryPath, predicate);
    return entry.isFile() && predicate(entryPath, entry.name) ? [entryPath] : [];
  });
}

function authorKeys(author) {
  return [author?.name_bn, author?.name_en, ...(author?.aliases || [])].map(normalizedTextKey).filter(Boolean);
}

function workTitleKeys(work) {
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

function candidateAuthorDisplay(candidate) {
  return (
    (candidate.authors || [])
      .filter((author) => (author.role || "author") === "author")
      .map((author) => cleanText(author.name_bn || author.name_en))
      .find(Boolean) || null
  );
}

const works = readJsonl(tables.works);
const authors = readJsonl(tables.authors);
const contributions = readJsonl(tables.contributions);
const reviews = readJsonl(duplicateReviewsPath);

const reviewedCandidateIds = new Set(
  reviews
    .filter((review) => review.status === "duplicate_of_main")
    .map((review) => cleanText(review.candidate_id))
    .filter(Boolean)
);

const authorById = new Map(authors.map((author) => [author.id, author]));
const workById = new Map(works.map((work) => [work.id, work]));
const mainIndex = new Map();
for (const contribution of contributions) {
  if ((contribution.role || "author") !== "author") continue;
  const author = authorById.get(contribution.author_id);
  const work = workById.get(contribution.work_id);
  if (!author || !work) continue;
  for (const authorKey of authorKeys(author)) {
    for (const titleKey of workTitleKeys(work)) {
      const indexKey = `${titleKey}||${authorKey}`;
      if (!mainIndex.has(indexKey)) mainIndex.set(indexKey, new Set());
      mainIndex.get(indexKey).add(work.id);
    }
  }
}

const archiveCandidateFiles = walkFiles(path.join(candidatesDir, "archive"), (_filePath, name) => name.endsWith(".jsonl"));
const matches = [];
const ambiguous = [];
let archiveCandidates = 0;
let alreadyReviewed = 0;

for (const filePath of archiveCandidateFiles) {
  for (const candidate of readJsonl(filePath)) {
    archiveCandidates += 1;
    if (reviewedCandidateIds.has(candidate.id)) {
      alreadyReviewed += 1;
      continue;
    }

    const workIds = new Set();
    const authorKeysForCandidate = candidateAuthorKeys(candidate);
    const titleKeysForCandidate = candidateTitleKeys(candidate);
    for (const authorKey of authorKeysForCandidate) {
      for (const titleKey of titleKeysForCandidate) {
        for (const workId of mainIndex.get(`${titleKey}||${authorKey}`) || []) workIds.add(workId);
      }
    }
    if (!workIds.size) continue;

    const row = {
      candidate,
      duplicate_of_work_ids: [...workIds].sort()
    };
    if (row.duplicate_of_work_ids.length === 1) matches.push(row);
    else ambiguous.push(row);
  }
}

matches.sort((left, right) => {
  const leftAuthor = candidateAuthorDisplay(left.candidate) || "";
  const rightAuthor = candidateAuthorDisplay(right.candidate) || "";
  const authorDelta = leftAuthor.localeCompare(rightAuthor);
  if (authorDelta) return authorDelta;
  const titleDelta = (left.candidate.title_bn || left.candidate.title_en || "").localeCompare(
    right.candidate.title_bn || right.candidate.title_en || ""
  );
  if (titleDelta) return titleDelta;
  return left.candidate.id.localeCompare(right.candidate.id);
});

const selectedMatches = Number.isInteger(limit) ? matches.slice(0, limit) : matches;
const reviewedAt = new Date().toISOString().slice(0, 10);
const newReviews = selectedMatches.map(({ candidate, duplicate_of_work_ids }) => ({
  candidate_id: candidate.id,
  status: "duplicate_of_main",
  duplicate_of_work_ids,
  reviewed_author: candidateAuthorDisplay(candidate) || "exact-title-author-batch",
  reviewed_at: reviewedAt,
  review_basis: "batch exact normalized title+author match already exists in main dataset; skipped ambiguous multi-work targets"
}));

const directUrlCount = selectedMatches.reduce(
  (sum, { candidate }) => sum + (candidate.sources || []).filter((source) => cleanText(source.url)).length,
  0
);

const topAuthors = new Map();
for (const { candidate } of selectedMatches) {
  const display = candidateAuthorDisplay(candidate) || "";
  topAuthors.set(display, (topAuthors.get(display) || 0) + 1);
}

if (apply && newReviews.length) {
  writeJsonl(duplicateReviewsPath, [...reviews, ...newReviews]);
}

console.log(
  JSON.stringify(
    {
      archive_candidates: archiveCandidates,
      already_reviewed: alreadyReviewed,
      unambiguous_exact_matches: matches.length,
      selected_matches: selectedMatches.length,
      direct_urls_in_selected_matches: directUrlCount,
      ambiguous_multi_work_matches: ambiguous.length,
      dry_run: !apply,
      top_selected_authors: [...topAuthors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)
    },
    null,
    2
  )
);

if (selectedMatches.length) {
  console.log("Sample matches:");
  for (const { candidate, duplicate_of_work_ids } of selectedMatches.slice(0, 30)) {
    const title = candidate.title_bn || candidate.title_en || candidate.id;
    const author = candidateAuthorDisplay(candidate) || "";
    const labels = (candidate.sources || []).map((source) => cleanText(source.label || source.source)).filter(Boolean);
    console.log(`- ${title} / ${author}: ${duplicate_of_work_ids.join(", ")} (${[...new Set(labels)].join(", ")})`);
  }
  if (selectedMatches.length > 30) console.log(`... ${selectedMatches.length - 30} more`);
}
