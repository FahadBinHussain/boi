const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { root, mainDir, tables } = require("./paths");
const { readJsonl, writeJsonl } = require("./jsonl-store");

const duplicateReviewsPath = path.join(mainDir, "candidate_duplicate_reviews.jsonl");

const archiveCandidateSources = [
  "small-islamic-sources",
  "medium-retailer-sources",
  "strong-retailer-sources",
  "granthagara",
  "wikimedia-bengali-scans",
  "rokomari-live"
];

function hash(value) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 16);
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

function hasBanglaScript(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
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

function titlePairFromRow(row) {
  const title = cleanText(row.title || row.raw_title || row.slug);
  const titleEn = cleanText(row.title_en);
  if (title && hasBanglaScript(title)) return { bn: title, en: titleEn && !hasBanglaScript(titleEn) ? titleEn : null };
  if (titleEn && hasBanglaScript(titleEn)) return { bn: titleEn, en: title && !hasBanglaScript(title) ? title : null };
  return { bn: null, en: titleEn || title };
}

function contributorRole(sourceKey) {
  if (sourceKey === "translators") return "translator";
  if (sourceKey === "editors") return "editor";
  return "author";
}

function contributorInput(row) {
  const contributors = [];
  for (const contributor of row.contributors || []) {
    const name = cleanText(contributor.name);
    if (!name) continue;
    contributors.push({ name, role: cleanText(contributor.role) || "author" });
  }

  for (const key of ["authors", "translators", "editors"]) {
    for (const value of row[key] || []) {
      const name = cleanText(value);
      if (name) contributors.push({ name, role: contributorRole(key) });
    }
  }

  for (const value of [row.author_bn, row.author_en, row.raw_author, row.commons_artist]) {
    const name = cleanText(value);
    if (name) contributors.push({ name, role: "author" });
  }

  const seen = new Set();
  return contributors
    .map((contributor) => ({
      name: contributor.name,
      role: cleanText(contributor.role) || "author"
    }))
    .filter((contributor) => {
      const key = normalizedTextKey(`${contributor.name}|${contributor.role}`);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((contributor) => ({
      name_bn: hasBanglaScript(contributor.name) ? contributor.name : null,
      name_en: hasBanglaScript(contributor.name) ? null : contributor.name,
      role: contributor.role
    }));
}

function sourceLabel(row) {
  return cleanText(row.source) || "Archive scrape";
}

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(entryPath, predicate);
    return entry.isFile() && predicate(entryPath, entry.name) ? [entryPath] : [];
  });
}

function latestRunDir(sourceSlug) {
  const archiveRoot = path.join(root, "archive", sourceSlug);
  if (!fs.existsSync(archiveRoot)) return null;
  const runs = fs
    .readdirSync(archiveRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(archiveRoot, entry.name);
      const manifestPath = path.join(dir, "manifest.json");
      return {
        name: entry.name,
        dir,
        mtimeMs: fs.existsSync(manifestPath) ? fs.statSync(manifestPath).mtimeMs : fs.statSync(dir).mtimeMs
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name));
  return runs[0] || null;
}

function archiveCandidateFiles(run, sourceSlug) {
  if (sourceSlug === "rokomari-live") {
    return [path.join(run.dir, "books.jsonl")].filter((filePath) => fs.existsSync(filePath));
  }
  return walkFiles(run.dir, (_filePath, name) => name === "books.jsonl");
}

function makeArchiveCandidate(row, filePath, run, sourceSlug) {
  const url = cleanText(row.url);
  if (!url) return null;

  const titles = titlePairFromRow(row);
  if (!cleanText(titles.bn || titles.en)) return null;

  const relativeRawPath = path.relative(root, filePath).replaceAll("\\", "/");
  const sourceIdentity = `${sourceSlug}|${run.name}|${url}|${row.source_id || row.product_id || ""}`;
  const candidate = {
    id: `candidate_archive_${hash(sourceIdentity)}`,
    title_bn: titles.bn,
    title_en: titles.en,
    authors: contributorInput(row),
    archive_record_count: 1,
    archive_source_slugs: [sourceSlug],
    raw_path: relativeRawPath,
    sources: [
      {
        label: sourceLabel(row),
        url,
        retrieved_at: cleanText(row.retrieved_at) || "2026-06-03",
        notes: relativeRawPath
      }
    ]
  };

  if (row.publication_year) candidate.first_published_year = row.publication_year;
  if (row.edition || row.isbn || row.pages) candidate.edition_count = 1;
  return candidate;
}

function archiveCandidateGroupKey(candidate) {
  const titleKey = normalizedTextKey(candidate.title_bn || candidate.title_en);
  if (!titleKey) return null;
  const authorKey = (candidate.authors || [])
    .map((author) => normalizedTextKey(`${author.role || "author"}|${author.name_bn || author.name_en}`))
    .filter(Boolean)
    .sort()
    .join("|");
  return `${titleKey}||${authorKey}`;
}

function mergeArchiveCandidate(group, candidate) {
  group.archive_record_count += 1;
  group.archive_source_slugs = Array.from(new Set([...group.archive_source_slugs, ...candidate.archive_source_slugs])).sort();
  const seenSourceUrls = new Set(group.sources.map((source) => source.url).filter(Boolean));
  for (const source of candidate.sources || []) {
    if (source.url && seenSourceUrls.has(source.url)) continue;
    if (source.url) seenSourceUrls.add(source.url);
    group.sources.push(source);
  }
  if (!group.first_published_year && candidate.first_published_year) group.first_published_year = candidate.first_published_year;
  if (!group.title_bn && candidate.title_bn) group.title_bn = candidate.title_bn;
  if (!group.title_en && candidate.title_en) group.title_en = candidate.title_en;
  if (!group.authors.length && candidate.authors.length) group.authors = candidate.authors;
  if (candidate.edition_count) group.edition_count = Math.max(group.edition_count || 0, candidate.edition_count);
}

function archiveCandidatesFromScrapes() {
  const groups = new Map();
  const seenUrls = new Set();

  for (const sourceSlug of archiveCandidateSources) {
    const run = latestRunDir(sourceSlug);
    if (!run) continue;
    for (const filePath of archiveCandidateFiles(run, sourceSlug)) {
      const rows = readJsonl(filePath);
      rows.forEach((row) => {
        const url = cleanText(row.url);
        if (!url || seenUrls.has(url)) return;
        const candidate = makeArchiveCandidate(row, filePath, run, sourceSlug);
        if (!candidate) return;
        const groupKey = archiveCandidateGroupKey(candidate);
        if (!groupKey) return;
        if (groups.has(groupKey)) {
          mergeArchiveCandidate(groups.get(groupKey), candidate);
        } else {
          candidate.id = `candidate_archive_${hash(groupKey)}`;
          groups.set(groupKey, candidate);
        }
        seenUrls.add(url);
      });
    }
  }

  return Array.from(groups.values());
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

function sourceIdForUrl(url) {
  return `source_candidate_duplicate_${hash(url)}`;
}

function authorNames(candidate) {
  return (candidate.authors || [])
    .map((author) => author.name_bn || author.name_en)
    .filter(Boolean)
    .join(" | ");
}

function sourceMappingsForReview(review, candidate) {
  if (Array.isArray(review.source_mappings) && review.source_mappings.length) {
    return review.source_mappings
      .map((mapping) => {
        const url = cleanText(mapping.url);
        if (!url) return null;
        const candidateSource = (candidate.sources || []).find((source) => cleanText(source.url) === url) || {};
        return {
          source: { ...candidateSource, ...mapping, url },
          duplicate_of_work_ids: mapping.duplicate_of_work_ids || mapping.work_ids || review.duplicate_of_work_ids || []
        };
      })
      .filter(Boolean);
  }

  return (candidate.sources || []).map((source) => ({
    source,
    duplicate_of_work_ids: review.duplicate_of_work_ids || []
  }));
}

const reviews = readJsonl(duplicateReviewsPath).filter((review) => review.status === "duplicate_of_main");
let sourceRecords = readJsonl(tables.sources);
let works = readJsonl(tables.works);

const sourceByUrl = new Map(sourceRecords.map((source) => [cleanText(source.url), source]).filter(([url]) => Boolean(url)));
const sourceIds = new Set(sourceRecords.map((source) => source.id));
const workById = new Map(works.map((work) => [work.id, work]));
const candidateById = new Map(archiveCandidatesFromScrapes().map((candidate) => [candidate.id, candidate]));

let createdSourceRecords = 0;
let reusedSourceRecords = 0;
let attachedSourceRefs = 0;
const missingCandidates = [];
const missingWorks = [];

for (const review of reviews) {
  const candidate = candidateById.get(review.candidate_id);
  if (!candidate) {
    missingCandidates.push(review.candidate_id);
    continue;
  }

  const sourceRefsByWorkId = new Map();
  for (const { source, duplicate_of_work_ids: duplicateOfWorkIds } of sourceMappingsForReview(review, candidate)) {
    const url = cleanText(source.url);
    if (!url) continue;
    const existing = sourceByUrl.get(url);
    if (existing) {
      for (const workId of duplicateOfWorkIds || []) {
        if (!sourceRefsByWorkId.has(workId)) sourceRefsByWorkId.set(workId, []);
        sourceRefsByWorkId.get(workId).push(existing.id);
      }
      reusedSourceRecords += 1;
      continue;
    }

    let sourceId = sourceIdForUrl(url);
    let suffix = 2;
    while (sourceIds.has(sourceId)) {
      sourceId = `${sourceIdForUrl(url)}_${suffix}`;
      suffix += 1;
    }

    const sourceRecord = {
      id: sourceId,
      source: cleanText(source.label) || "Reviewed duplicate candidate",
      url,
      retrieved_at: cleanText(source.retrieved_at) || "2026-06-03",
      raw_path: cleanText(source.notes) || candidate.raw_path || null,
      external_id: null,
      record_type: "book",
      raw_title: candidate.title_bn || candidate.title_en || null,
      raw_author: authorNames(candidate) || null,
      notes: `Direct source link from reviewed duplicate candidate ${candidate.id}; keep as reference on main work(s): ${(duplicateOfWorkIds || []).join(", ")}.`,
      aliases: [],
      source_refs: []
    };

    sourceRecords.push(sourceRecord);
    sourceByUrl.set(url, sourceRecord);
    sourceIds.add(sourceId);
    for (const workId of duplicateOfWorkIds || []) {
      if (!sourceRefsByWorkId.has(workId)) sourceRefsByWorkId.set(workId, []);
      sourceRefsByWorkId.get(workId).push(sourceId);
    }
    createdSourceRecords += 1;
  }

  for (const [workId, sourceRefs] of sourceRefsByWorkId) {
    const work = workById.get(workId);
    if (!work) {
      missingWorks.push({ candidate_id: review.candidate_id, work_id: workId });
      continue;
    }
    const before = (work.source_refs || []).length;
    work.source_refs = mergeArrayValues(work.source_refs, sourceRefs);
    attachedSourceRefs += work.source_refs.length - before;
  }
}

if (missingWorks.length) {
  console.error(JSON.stringify({ missing_works: missingWorks }, null, 2));
  process.exit(1);
}

writeJsonl(tables.sources, sourceRecords);
writeJsonl(tables.works, works);

console.log(
  JSON.stringify(
    {
      duplicate_reviews: reviews.length,
      created_source_records: createdSourceRecords,
      reused_source_records: reusedSourceRecords,
      attached_source_refs: attachedSourceRefs,
      missing_archive_candidates: missingCandidates.length
    },
    null,
    2
  )
);

if (missingCandidates.length) {
  console.log("Skipped missing archive candidate ids:");
  for (const candidateId of missingCandidates) console.log(`- ${candidateId}`);
}
