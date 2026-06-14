const fs = require("node:fs");
const path = require("node:path");
const { root, tables, generated } = require("./paths");
const {
  countJsonlRows: countJsonlRowsFromStore,
  isPagedTablePath,
  pagedTablePageFiles,
  readJsonlWithLocations,
} = require("./jsonl-store");

const files = {
  sources: tables.sources,
  authors: tables.authors,
  works: tables.works,
  editions: tables.editions,
  contributions: tables.contributions,
  candidateAuthors: generated.candidateAuthors,
  candidateBooks: generated.candidateBooks,
  archiveCandidateManifest: path.join(path.dirname(generated.candidateBooks), "archive-manifest.json")
};

const allowedRoles = new Set([
  "author",
  "editor",
  "translator",
  "adapter",
  "compiler",
  "illustrator",
  "unknown"
]);

const errors = [];

function readJsonl(filePath) {
  if (!fs.existsSync(filePath) && !(isPagedTablePath(filePath) && pagedTablePageFiles(filePath).length)) {
    errors.push(`Missing file: ${path.relative(root, filePath)}`);
    return [];
  }

  const rows = [];
  for (const row of readJsonlWithLocations(filePath, root)) {
    try {
      rows.push({ record: JSON.parse(row.raw), line: row.line });
    } catch (error) {
      errors.push(`${row.line} invalid JSON: ${error.message}`);
    }
  }

  return rows;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`${path.relative(root, filePath)} invalid JSON: ${error.message}`);
    return null;
  }
}

function countJsonlRows(filePath) {
  if (!fs.existsSync(filePath) && !(isPagedTablePath(filePath) && pagedTablePageFiles(filePath).length)) {
    errors.push(`Missing file: ${path.relative(root, filePath)}`);
    return 0;
  }
  return countJsonlRowsFromStore(filePath);
}

function requireString(record, field, location) {
  if (typeof record[field] !== "string" || !record[field].trim()) {
    errors.push(`${location} missing non-empty string field "${field}"`);
  }
}

function requireArray(record, field, location) {
  if (!Array.isArray(record[field])) {
    errors.push(`${location} missing array field "${field}"`);
  }
}

function requireConfidence(record, location) {
  if (typeof record.confidence !== "number" || record.confidence < 0 || record.confidence > 1) {
    errors.push(`${location} confidence must be a number between 0 and 1`);
  }
}

function validateUniqueIds(rows, label) {
  const seen = new Map();
  for (const row of rows) {
    const id = row.record.id;
    const location = `${label}:${row.line}`;
    requireString(row.record, "id", location);
    if (!id) continue;
    if (seen.has(id)) {
      errors.push(`${location} duplicate id "${id}" also seen on line ${seen.get(id)}`);
    } else {
      seen.set(id, row.line);
    }
  }
  return seen;
}

function validateSourceRefs(record, location, sourceIds) {
  requireArray(record, "source_refs", location);
  if (!Array.isArray(record.source_refs)) return;

  if (record.source_refs.length === 0) {
    errors.push(`${location} source_refs must not be empty`);
  }

  const seen = new Set();
  for (const ref of record.source_refs) {
    if (typeof ref !== "string" || !ref.trim()) {
      errors.push(`${location} source_refs must contain source record ids`);
      continue;
    }
    if (seen.has(ref)) {
      errors.push(`${location} duplicate source ref "${ref}"`);
    }
    seen.add(ref);
    if (!sourceIds.has(ref)) {
      errors.push(`${location} source ref "${ref}" not found in source_records`);
    }
  }
}

function validateCandidateRows(rows, label) {
  validateUniqueIds(rows, label);
  for (const row of rows) {
    const record = row.record;
    const location = `${label}:${row.line}`;
    requireString(record, "id", location);
    if (!["pending", "verified", "rejected"].includes(record.verification_status)) {
      errors.push(`${location} verification_status must be pending, verified, or rejected`);
    }
    if (!Array.isArray(record.sources)) {
      errors.push(`${location} sources must be an array`);
      continue;
    }
    record.sources.forEach((source, index) => {
      const sourceLocation = `${location}.sources[${index}]`;
      requireString(source, "label", sourceLocation);
      requireString(source, "url", sourceLocation);
      requireString(source, "retrieved_at", sourceLocation);
      if (typeof source.notes !== "string") {
        errors.push(`${sourceLocation} notes must be a string`);
      }
      if (
        typeof source.retrieved_at === "string" &&
        !/^\d{4}-\d{2}-\d{2}$/.test(source.retrieved_at)
      ) {
        errors.push(`${sourceLocation} retrieved_at must be YYYY-MM-DD`);
      }
    });
  }
}

const sourceRows = readJsonl(files.sources);
const authorRows = readJsonl(files.authors);
const workRows = readJsonl(files.works);
const editionRows = readJsonl(files.editions);
const contributionRows = readJsonl(files.contributions);
const candidateAuthorRows = readJsonl(files.candidateAuthors);
const candidateBookRows = readJsonl(files.candidateBooks);
const archiveCandidateManifest = readJson(files.archiveCandidateManifest);

const sourceIds = validateUniqueIds(sourceRows, "main/source_records");
const authorIds = validateUniqueIds(authorRows, "main/authors.jsonl");
const workIds = validateUniqueIds(workRows, "main/works.jsonl");
const editionIds = validateUniqueIds(editionRows, "main/editions.jsonl");
validateUniqueIds(contributionRows, "main/contributions.jsonl");

for (const row of sourceRows) {
  const record = row.record;
  const location = `main/source_records:${row.line}`;
  requireString(record, "source", location);
  requireString(record, "retrieved_at", location);
  requireString(record, "record_type", location);
  if (
    typeof record.retrieved_at === "string" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(record.retrieved_at)
  ) {
    errors.push(`${location} retrieved_at must be YYYY-MM-DD`);
  }
}

for (const row of authorRows) {
  const record = row.record;
  const location = `main/authors.jsonl:${row.line}`;
  if (!record.name_bn && !record.name_en) {
    errors.push(`${location} needs name_bn or name_en`);
  }
  requireArray(record, "aliases", location);
  validateSourceRefs(record, location, sourceIds);
  requireConfidence(record, location);
}

for (const row of workRows) {
  const record = row.record;
  const location = `main/works.jsonl:${row.line}`;
  if (!record.title_bn && !record.title_en) {
    errors.push(`${location} needs title_bn or title_en`);
  }
  requireString(record, "language", location);
  requireArray(record, "aliases", location);
  validateSourceRefs(record, location, sourceIds);
  requireConfidence(record, location);
}

for (const row of editionRows) {
  const record = row.record;
  const location = `main/editions.jsonl:${row.line}`;
  requireString(record, "work_id", location);
  requireString(record, "title_as_printed", location);
  if (record.work_id && !workIds.has(record.work_id)) {
    errors.push(`${location} work_id "${record.work_id}" not found in works.jsonl`);
  }
  validateSourceRefs(record, location, sourceIds);
  requireConfidence(record, location);
}

for (const row of contributionRows) {
  const record = row.record;
  const location = `main/contributions.jsonl:${row.line}`;
  requireString(record, "work_id", location);
  requireString(record, "author_id", location);
  requireString(record, "role", location);
  if (record.work_id && !workIds.has(record.work_id)) {
    errors.push(`${location} work_id "${record.work_id}" not found in works.jsonl`);
  }
  if (record.author_id && !authorIds.has(record.author_id)) {
    errors.push(`${location} author_id "${record.author_id}" not found in authors.jsonl`);
  }
  if (record.edition_id && !editionIds.has(record.edition_id)) {
    errors.push(`${location} edition_id "${record.edition_id}" not found in editions.jsonl`);
  }
  if (record.role && !allowedRoles.has(record.role)) {
    errors.push(`${location} role "${record.role}" is not allowed`);
  }
  validateSourceRefs(record, location, sourceIds);
  requireConfidence(record, location);
}

validateCandidateRows(candidateAuthorRows, "main/generated/candidates/authors.jsonl");
validateCandidateRows(candidateBookRows, "main/generated/candidates/books.jsonl");

let archiveCandidateCount = 0;
if (archiveCandidateManifest) {
  if (!Array.isArray(archiveCandidateManifest.shards)) {
    errors.push("main/generated/candidates/archive-manifest.json shards must be an array");
  } else {
    for (const shard of archiveCandidateManifest.shards) {
      const shardPath = path.join(path.dirname(files.archiveCandidateManifest), shard.path || "");
      const actualCount = countJsonlRows(shardPath);
      archiveCandidateCount += actualCount;
      if (actualCount !== shard.count) {
        errors.push(`${path.relative(root, shardPath)} has ${actualCount} rows but manifest says ${shard.count}`);
      }
    }
  }
  if (archiveCandidateCount !== archiveCandidateManifest.total) {
    errors.push(`main/generated/candidates/archive-manifest.json total is ${archiveCandidateManifest.total}, counted ${archiveCandidateCount}`);
  }
}

if (errors.length > 0) {
  console.error(`Dataset validation failed with ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Dataset validation passed.");
console.log(
  JSON.stringify(
    {
      source_records: sourceRows.length,
      authors: authorRows.length,
      works: workRows.length,
      editions: editionRows.length,
      contributions: contributionRows.length,
      candidate_authors: candidateAuthorRows.length,
      candidate_books: candidateBookRows.length,
      archive_candidate_books: archiveCandidateCount
    },
    null,
    2
  )
);
