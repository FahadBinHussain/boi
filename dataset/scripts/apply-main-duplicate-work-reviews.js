const fs = require("node:fs");
const path = require("node:path");
const { mainDir, tables } = require("./paths");
const { readJsonl, writeJsonl } = require("./jsonl-store");

const reviewsPath = path.join(mainDir, "main_duplicate_work_reviews.jsonl");

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

const apply = process.argv.includes("--apply");
const reviewIdFilter = argValue("--review-id");

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
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

function acceptedReviews(reviews) {
  return reviews.filter((review) => {
    if (reviewIdFilter && review.review_id !== reviewIdFilter) return false;
    return ["duplicate_of_main", "merge_into_main", "accepted_duplicate"].includes(cleanText(review.status));
  });
}

function reviewDuplicateIds(review) {
  const ids = review.duplicate_work_ids || review.removed_work_ids || review.merge_work_ids || [];
  return ids.map(cleanText).filter(Boolean);
}

let works = readJsonl(tables.works);
let editions = readJsonl(tables.editions);
let contributions = readJsonl(tables.contributions);
const reviews = fs.existsSync(reviewsPath) ? readJsonl(reviewsPath) : [];
const selectedReviews = acceptedReviews(reviews);

const workById = new Map(works.map((work) => [work.id, work]));
const retarget = new Map();
const mergeDetails = [];
const skipped = [];

for (const review of selectedReviews) {
  const canonicalWorkId = cleanText(review.canonical_work_id || review.duplicate_of_work_id || review.target_work_id);
  if (!canonicalWorkId) {
    skipped.push({ review_id: review.review_id || null, reason: "missing canonical_work_id" });
    continue;
  }

  const canonical = workById.get(canonicalWorkId);
  if (!canonical) {
    skipped.push({ review_id: review.review_id || null, canonical_work_id: canonicalWorkId, reason: "missing canonical work" });
    continue;
  }

  const duplicateIds = reviewDuplicateIds(review).filter((workId) => workId !== canonicalWorkId);
  const duplicates = duplicateIds.map((workId) => workById.get(workId)).filter(Boolean);
  const missingDuplicateIds = duplicateIds.filter((workId) => !workById.has(workId) && !retarget.has(workId));
  if (!duplicates.length) {
    skipped.push({
      review_id: review.review_id || null,
      canonical_work_id: canonicalWorkId,
      duplicate_work_ids: duplicateIds,
      reason: missingDuplicateIds.length ? "duplicates already missing or previously merged" : "no duplicate_work_ids"
    });
    continue;
  }

  const years = [canonical, ...duplicates].map((work) => work.first_published_year).filter((year) => Number.isInteger(year));
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
  mergeDetails.push({
    review_id: review.review_id || null,
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
}

const summary = {
  reviews_path: path.relative(mainDir, reviewsPath).replaceAll("\\", "/"),
  selected_reviews: selectedReviews.length,
  merged_reviews: mergeDetails.length,
  removed_work_rows: retarget.size,
  skipped_reviews: skipped.length,
  dry_run: !apply
};

console.log(JSON.stringify(summary, null, 2));
if (mergeDetails.length) {
  console.log("Reviewed merge groups:");
  for (const detail of mergeDetails.slice(0, 80)) {
    console.log(`- ${detail.removed_work_ids.join(", ")} -> ${detail.canonical_work_id}`);
  }
  if (mergeDetails.length > 80) console.log(`... ${mergeDetails.length - 80} more`);
}
if (skipped.length) {
  console.log("Skipped reviews:");
  for (const detail of skipped.slice(0, 30)) console.log(`- ${JSON.stringify(detail)}`);
  if (skipped.length > 30) console.log(`... ${skipped.length - 30} more`);
}

if (apply) {
  writeJsonl(tables.works, works);
  writeJsonl(tables.editions, editions);
  writeJsonl(tables.contributions, contributions);
}
