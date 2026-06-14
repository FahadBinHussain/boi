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
const limitValue = argValue("--limit");
const limit = limitValue ? Number.parseInt(limitValue, 10) : null;

if (!authorName) {
  console.error("Usage: node dataset/scripts/review-archive-duplicates-by-author.js --author <name> [--limit <n>] [--apply]");
  process.exit(1);
}
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

function mergeArrayValues(...arrays) {
  const out = [];
  const seen = new Set();
  for (const values of arrays) {
    for (const value of values || []) {
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }
  }
  return out;
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

const authorKey = normalizedTextKey(authorName);
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
const contributionsByWork = new Map();
for (const contribution of contributions) {
  if ((contribution.role || "author") !== "author") continue;
  if (!contributionsByWork.has(contribution.work_id)) contributionsByWork.set(contribution.work_id, []);
  contributionsByWork.get(contribution.work_id).push(contribution);
}

const mainIndex = new Map();
for (const work of works) {
  const hasAuthor = (contributionsByWork.get(work.id) || []).some((contribution) =>
    authorKeys(authorById.get(contribution.author_id)).includes(authorKey)
  );
  if (!hasAuthor) continue;
  for (const titleKey of workTitleKeys(work)) {
    const indexKey = `${titleKey}||${authorKey}`;
    if (!mainIndex.has(indexKey)) mainIndex.set(indexKey, []);
    mainIndex.get(indexKey).push(work.id);
  }
}

const archiveCandidateFiles = walkFiles(path.join(candidatesDir, "archive"), (_filePath, name) => name.endsWith(".jsonl"));
const matches = [];
let scopedCandidates = 0;
let alreadyReviewed = 0;

for (const filePath of archiveCandidateFiles) {
  for (const candidate of readJsonl(filePath)) {
    if (!candidateAuthorKeys(candidate).includes(authorKey)) continue;
    scopedCandidates += 1;
    if (reviewedCandidateIds.has(candidate.id)) {
      alreadyReviewed += 1;
      continue;
    }

    const workIds = new Set();
    for (const titleKey of candidateTitleKeys(candidate)) {
      for (const workId of mainIndex.get(`${titleKey}||${authorKey}`) || []) workIds.add(workId);
    }
    if (!workIds.size) continue;

    matches.push({
      candidate,
      duplicate_of_work_ids: [...workIds].sort()
    });
  }
}

matches.sort((left, right) => {
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
  reviewed_author: authorName,
  reviewed_at: reviewedAt,
  review_basis: `author-specific ${authorName} pass; exact normalized title+author match already exists in main dataset`
}));

const directUrlCount = selectedMatches.reduce(
  (sum, { candidate }) => sum + (candidate.sources || []).filter((source) => cleanText(source.url)).length,
  0
);
const multiWorkMatches = selectedMatches.filter((match) => match.duplicate_of_work_ids.length > 1).length;

console.log(
  JSON.stringify(
    {
      author: authorName,
      scoped_archive_candidates: scopedCandidates,
      already_reviewed: alreadyReviewed,
      exact_duplicate_matches: matches.length,
      selected_matches: selectedMatches.length,
      direct_urls_in_selected_matches: directUrlCount,
      multi_work_matches: multiWorkMatches,
      dry_run: !apply
    },
    null,
    2
  )
);

if (selectedMatches.length) {
  console.log("Sample matches:");
  for (const match of selectedMatches.slice(0, 30)) {
    const candidate = match.candidate;
    const title = candidate.title_bn || candidate.title_en || candidate.id;
    const sourceLabels = mergeArrayValues((candidate.sources || []).map((source) => source.label)).join(", ");
    console.log(`- ${title}: ${match.duplicate_of_work_ids.join(", ")} (${sourceLabels})`);
  }
  if (selectedMatches.length > 30) console.log(`... ${selectedMatches.length - 30} more`);
}

if (apply && newReviews.length) {
  writeJsonl(duplicateReviewsPath, [...reviews, ...newReviews]);
}
