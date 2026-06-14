const fs = require("node:fs");
const { tables, generated } = require("./paths");

const dryRun = process.argv.includes("--dry-run") || process.argv.includes("--check");

const paths = {
  candidateBooks: generated.candidateBooks,
  works: tables.works,
  editions: tables.editions,
  contributions: tables.contributions
};

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
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function visibleTitle(candidate) {
  return candidate.title_bn || candidate.title_en || "";
}

function groupKey(candidate) {
  return JSON.stringify({
    title: visibleTitle(candidate).normalize("NFKC").trim(),
    source_refs: candidate.source_refs || []
  });
}

function mergeArrayValues(...arrays) {
  const out = [];
  const seen = new Set();
  for (const values of arrays) {
    for (const value of values || []) {
      const key = JSON.stringify(value);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

function chooseCanonical(group) {
  return [...group].sort((a, b) => {
    if (b.edition_count !== a.edition_count) return b.edition_count - a.edition_count;
    return a.normalized_work_id.localeCompare(b.normalized_work_id);
  })[0];
}

const candidatesRows = readJsonl(paths.candidateBooks);
let works = readJsonl(paths.works);
let editions = readJsonl(paths.editions);
let contributions = readJsonl(paths.contributions);

const workById = new Map(works.map((work) => [work.id, work]));
const groups = new Map();
for (const candidate of candidatesRows) {
  const key = groupKey(candidate);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(candidate);
}

const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
const skipped = [];
const merged = [];
const retarget = new Map();
const editionRetarget = new Map();

function editionKey(edition) {
  return JSON.stringify({
    title_as_printed: edition.title_as_printed || null,
    publisher: edition.publisher || null,
    publication_year: edition.publication_year || null,
    isbn: edition.isbn || null,
    pages: edition.pages || null,
    format: edition.format || null
  });
}

function chooseCanonicalEdition(groupEditions) {
  return [...groupEditions].sort((a, b) => {
    const sourceDelta = (b.source_refs || []).length - (a.source_refs || []).length;
    if (sourceDelta) return sourceDelta;
    const aCandidate = a.id.startsWith("edition_candidate_research_") ? 1 : 0;
    const bCandidate = b.id.startsWith("edition_candidate_research_") ? 1 : 0;
    if (aCandidate !== bCandidate) return aCandidate - bCandidate;
    return a.id.localeCompare(b.id);
  })[0];
}

function duplicateEditionsForGroup(group) {
  const workIds = new Set(group.map((candidate) => candidate.normalized_work_id));
  const groupEditions = editions.filter((edition) => workIds.has(edition.work_id));
  if (groupEditions.length < 2) return null;

  const keys = new Set(groupEditions.map(editionKey));
  if (keys.size !== 1) return null;

  const canonicalEdition = chooseCanonicalEdition(groupEditions);
  const canonicalSourceRefs = new Set(canonicalEdition.source_refs || []);
  for (const edition of groupEditions) {
    for (const ref of edition.source_refs || []) {
      canonicalSourceRefs.add(ref);
    }
  }

  return {
    canonicalEdition,
    duplicateEditions: groupEditions.filter((edition) => edition.id !== canonicalEdition.id),
    source_refs: Array.from(canonicalSourceRefs)
  };
}

for (const group of duplicateGroups) {
  const editionfulWorks = group.filter((candidate) => candidate.edition_count > 0);
  const editionMerge = duplicateEditionsForGroup(group);
  if (editionfulWorks.length > 1 && !editionMerge) {
    skipped.push({
      title: visibleTitle(group[0]),
      work_ids: group.map((candidate) => candidate.normalized_work_id),
      reason: "multiple non-identical edition-bearing work rows"
    });
    continue;
  }

  const canonicalCandidate = editionMerge
    ? group.find((candidate) => candidate.normalized_work_id === editionMerge.canonicalEdition.work_id) || chooseCanonical(group)
    : chooseCanonical(group);
  const canonicalId = canonicalCandidate.normalized_work_id;
  const canonicalWork = workById.get(canonicalId);
  if (!canonicalWork) {
    skipped.push({
      title: visibleTitle(group[0]),
      work_ids: group.map((candidate) => candidate.normalized_work_id),
      reason: "canonical work row missing"
    });
    continue;
  }

  const duplicateIds = group
    .map((candidate) => candidate.normalized_work_id)
    .filter((workId) => workId !== canonicalId);

  const duplicateWorks = duplicateIds.map((workId) => workById.get(workId)).filter(Boolean);
  canonicalWork.source_refs = mergeArrayValues(
    canonicalWork.source_refs,
    ...duplicateWorks.map((work) => work.source_refs)
  );
  canonicalWork.aliases = mergeArrayValues(canonicalWork.aliases, ...duplicateWorks.map((work) => work.aliases));
  canonicalWork.confidence = Math.max(canonicalWork.confidence || 0, ...duplicateWorks.map((work) => work.confidence || 0));

  for (const work of duplicateWorks) {
    if (!canonicalWork.title_bn && work.title_bn) canonicalWork.title_bn = work.title_bn;
    if (!canonicalWork.title_en && work.title_en) canonicalWork.title_en = work.title_en;
    if (!canonicalWork.first_published_year && work.first_published_year) {
      canonicalWork.first_published_year = work.first_published_year;
    }
    if (!canonicalWork.genre && work.genre) canonicalWork.genre = work.genre;
  }

  for (const duplicateId of duplicateIds) {
    retarget.set(duplicateId, canonicalId);
  }
  if (editionMerge) {
    const canonicalEdition = editionMerge.canonicalEdition;
    canonicalEdition.source_refs = editionMerge.source_refs;
    canonicalEdition.aliases = mergeArrayValues(
      canonicalEdition.aliases,
      ...editionMerge.duplicateEditions.map((edition) => edition.aliases)
    );
    canonicalEdition.confidence = Math.max(
      canonicalEdition.confidence || 0,
      ...editionMerge.duplicateEditions.map((edition) => edition.confidence || 0)
    );
    for (const edition of editionMerge.duplicateEditions) {
      editionRetarget.set(edition.id, canonicalEdition.id);
    }
  }

  merged.push({
    title: visibleTitle(group[0]),
    canonical_work_id: canonicalId,
    removed_work_ids: duplicateIds,
    removed_edition_ids: editionMerge?.duplicateEditions.map((edition) => edition.id) || []
  });
}

if (retarget.size) {
  works = works.filter((work) => !retarget.has(work.id));
  editions = editions.map((edition) =>
    retarget.has(edition.work_id) ? { ...edition, work_id: retarget.get(edition.work_id) } : edition
  );
  contributions = contributions.map((contribution) =>
    retarget.has(contribution.work_id)
      ? { ...contribution, work_id: retarget.get(contribution.work_id) }
      : contribution
  );
}
if (editionRetarget.size) {
  editions = editions.filter((edition) => !editionRetarget.has(edition.id));
  contributions = contributions.map((contribution) =>
    editionRetarget.has(contribution.edition_id)
      ? { ...contribution, edition_id: editionRetarget.get(contribution.edition_id) }
      : contribution
  );
}

const summary = {
  duplicate_groups_seen: duplicateGroups.length,
  merged_groups: merged.length,
  removed_work_rows: [...retarget.keys()].length,
  removed_edition_rows: [...editionRetarget.keys()].length,
  skipped_groups: skipped.length,
  dry_run: dryRun
};

console.log(JSON.stringify(summary, null, 2));
if (merged.length) {
  console.log("Merged groups:");
  for (const item of merged) {
    const editionNote = item.removed_edition_ids.length
      ? `; editions ${item.removed_edition_ids.join(", ")} merged`
      : "";
    console.log(`- ${item.title}: ${item.removed_work_ids.join(", ")} -> ${item.canonical_work_id}${editionNote}`);
  }
}
if (skipped.length) {
  console.log("Skipped groups:");
  for (const item of skipped) {
    console.log(`- ${item.title}: ${item.reason} (${item.work_ids.join(", ")})`);
  }
}

if (!dryRun) {
  writeJsonl(paths.works, works);
  writeJsonl(paths.editions, editions);
  writeJsonl(paths.contributions, contributions);
}
