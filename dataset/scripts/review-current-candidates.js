const fs = require("node:fs");
const path = require("node:path");
const { mainDir, generated } = require("./paths");

const candidatesPath = generated.candidateBooks;
const reviewsPath = path.join(mainDir, "candidate_duplicate_reviews.jsonl");
const reviewedAt = process.env.REVIEWED_AT || new Date().toISOString().slice(0, 10);

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

function hasBanglaScript(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function isArchiveOnlyCandidate(candidate) {
  const reason = cleanText(candidate.reason) || "";
  if (/Internet Archive is the only source reference/i.test(reason)) return true;
  if (/Internet Archive item was restricted/i.test(reason)) return true;
  if (/Internet Archive OCR\/PDF was checked/i.test(reason)) return true;

  const sources = candidate.sources || [];
  return sources.length > 0 && sources.every((source) => /^Internet Archive\b/i.test(source.label || ""));
}

function reviewForCandidate(candidate) {
  if (isArchiveOnlyCandidate(candidate)) {
    return {
      candidate_id: candidate.id,
      status: "archive_only_unverified",
      duplicate_of_work_ids: [],
      reviewed_author: "candidate-final-pass",
      reviewed_at: reviewedAt,
      review_basis:
        "Final candidate cleanup: prior source research left this row without non-Archive support. Keep it out of the public candidate/export queue until a direct non-Archive catalog link verifies the bibliographic work."
    };
  }

  const title = cleanText(candidate.title_bn || candidate.title_en);
  const titleKind = title && hasBanglaScript(title) ? "Bangla-script" : "non-Bangla-script";
  return {
    candidate_id: candidate.id,
    status: "title_script_unverified",
    duplicate_of_work_ids: [],
    reviewed_author: "candidate-final-pass",
    reviewed_at: reviewedAt,
    review_basis: `Final candidate cleanup: source evidence exists, but the visible title is ${titleKind} and still needs a clean Bangla bibliographic title before public BOI promotion.`
  };
}

const candidates = readJsonl(candidatesPath);
const reviews = readJsonl(reviewsPath);
const reviewedCandidateIds = new Set(reviews.map((review) => cleanText(review.candidate_id)).filter(Boolean));
const nextReviews = candidates.filter((candidate) => candidate.id && !reviewedCandidateIds.has(candidate.id)).map(reviewForCandidate);

if (nextReviews.length) {
  const previous = fs.existsSync(reviewsPath) ? fs.readFileSync(reviewsPath, "utf8") : "";
  const separator = previous && !previous.endsWith("\n") ? "\n" : "";
  fs.appendFileSync(reviewsPath, separator + nextReviews.map((review) => JSON.stringify(review)).join("\n") + "\n", "utf8");
}

const counts = {};
for (const review of nextReviews) counts[review.status] = (counts[review.status] || 0) + 1;

console.log(
  JSON.stringify(
    {
      candidates_read: candidates.length,
      reviews_appended: nextReviews.length,
      counts
    },
    null,
    2
  )
);
