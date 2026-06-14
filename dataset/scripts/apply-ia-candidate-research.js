const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { archiveDir, tables: paths } = require("./paths");
const { readJsonl } = require("./jsonl-store");

const researchPath = path.join(archiveDir, "internet_archive_candidate_research", "research.json");

function writeJsonl(filePath, rows) {
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
}

function hash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 14);
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
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
    .trim();
}

function researchNote(item) {
  return `Archive candidate research: ${item.status}. ${item.evidence}`;
}

function mergeNotes(previous, next) {
  const base = cleanText(previous);
  if (!base) return next;
  const withoutOld = base.replace(/\s*Archive candidate research: .*$/u, "").trim();
  return `${withoutOld} ${next}`.trim();
}

const research = JSON.parse(fs.readFileSync(researchPath, "utf8")).items;
let sources = readJsonl(paths.sources);
let authors = readJsonl(paths.authors);
let works = readJsonl(paths.works);
let editions = readJsonl(paths.editions);
let contributions = readJsonl(paths.contributions);

const authorById = new Map(authors.map((author) => [author.id, author]));
const authorKeyToId = new Map();
for (const author of authors) {
  const authorKey = key(author.name_bn || author.name_en);
  if (authorKey) authorKeyToId.set(authorKey, author.id);
}

function ensureAuthor(input, sourceId) {
  const nameKey = key(input.name_bn || input.name_en);
  const id = (nameKey && authorKeyToId.get(nameKey)) || `author_ia_verified_${hash(input.name_bn || input.name_en)}`;
  if (nameKey) authorKeyToId.set(nameKey, id);
  const previous = authorById.get(id);
  const row = {
    id,
    name_bn: input.name_bn ?? previous?.name_bn ?? null,
    name_en: input.name_en ?? previous?.name_en ?? null,
    aliases: Array.from(new Set([...(previous?.aliases || []), ...(input.aliases || [])].filter(Boolean))),
    birth_year: previous?.birth_year ?? null,
    death_year: previous?.death_year ?? null,
    country_or_region: previous?.country_or_region ?? null,
    notes: previous?.notes ?? null,
    source_refs: Array.from(new Set([...(previous?.source_refs || []), sourceId])),
    confidence: Math.max(previous?.confidence || 0, 0.84)
  };
  authorById.set(id, row);
  return id;
}

function contributorNameKey(contributor) {
  return key(contributor.name_bn || contributor.name_en);
}

function buildWorkKeyMap() {
  const workKeyToId = new Map();
  const authorsNow = new Map(Array.from(authorById.values()).map((author) => [author.id, author]));
  const contributionsByWork = new Map();
  for (const contribution of contributions) {
    const list = contributionsByWork.get(contribution.work_id) || [];
    list.push(contribution);
    contributionsByWork.set(contribution.work_id, list);
  }
  for (const work of works) {
    const workContributions = contributionsByWork.get(work.id) || [];
    for (const contribution of workContributions) {
      const author = authorsNow.get(contribution.author_id);
      const mapKey = key(`${work.title_bn || work.title_en}|${author?.name_bn || author?.name_en || contribution.author_id}`);
      if (mapKey) workKeyToId.set(mapKey, work.id);
    }
  }
  return workKeyToId;
}

const sourceByIdentifier = new Map();
for (const source of sources) {
  if (source.source !== "Internet Archive") continue;
  const identifier = source.external_id || source.url?.match(/archive\.org\/details\/([^/?#]+)/)?.[1];
  if (!identifier) continue;
  const list = sourceByIdentifier.get(identifier) || [];
  list.push(source);
  sourceByIdentifier.set(identifier, list);
}

let verifiedCount = 0;
let rejectedCount = 0;
let manualCount = 0;

for (const [identifier, item] of Object.entries(research)) {
  const sourceRows = sourceByIdentifier.get(identifier) || [];
  if (!sourceRows.length) continue;

  for (const source of sourceRows) {
    source.notes = mergeNotes(source.notes, researchNote(item));

    if (item.status !== "verified_book") {
      if (item.status === "needs_manual_review" || item.status === "restricted_unverified") manualCount += 1;
      else rejectedCount += 1;
      continue;
    }

    const contributors = item.contributors || [];
    if (!contributors.length || !cleanText(item.title_bn || item.title_en)) {
      manualCount += 1;
      continue;
    }

    const authorIds = contributors.map((contributor) => ensureAuthor(contributor, source.id));
    const primaryContributorKey = contributorNameKey(contributors[0]) || authorIds[0];
    const workKeyToId = buildWorkKeyMap();
    const targetWorkKey = key(`${item.title_bn || item.title_en}|${primaryContributorKey}`);
    const targetWorkId = (targetWorkKey && workKeyToId.get(targetWorkKey)) || `work_ia_verified_${hash(`${identifier}|${item.title_bn || item.title_en}|${primaryContributorKey}`)}`;

    for (const work of works) {
      work.source_refs = (work.source_refs || []).filter((sourceRef) => sourceRef !== source.id);
    }

    let targetWork = works.find((work) => work.id === targetWorkId);
    if (!targetWork) {
      targetWork = {
        id: targetWorkId,
        title_bn: item.title_bn || null,
        title_en: item.title_en || null,
        aliases: [],
        language: "bn",
        genre: null,
        first_published_year: item.publication_year ?? null,
        source_refs: [],
        confidence: 0
      };
      works.push(targetWork);
    }

    targetWork.title_bn = item.title_bn ?? targetWork.title_bn ?? null;
    targetWork.title_en = item.title_en ?? targetWork.title_en ?? null;
    targetWork.language = "bn";
    targetWork.first_published_year = item.publication_year ?? targetWork.first_published_year ?? null;
    targetWork.source_refs = Array.from(new Set([...(targetWork.source_refs || []), source.id]));
    targetWork.confidence = Math.max(targetWork.confidence || 0, 0.84);

    const sourceEdition = editions.find((edition) => (edition.source_refs || []).includes(source.id));
    if (sourceEdition) {
      sourceEdition.work_id = targetWork.id;
      sourceEdition.title_as_printed = item.title_bn || item.title_en;
      sourceEdition.publication_year = item.publication_year ?? sourceEdition.publication_year ?? null;
      sourceEdition.confidence = Math.max(sourceEdition.confidence || 0, 0.84);
    } else {
      editions.push({
        id: `edition_ia_verified_${hash(identifier)}`,
        work_id: targetWork.id,
        title_as_printed: item.title_bn || item.title_en,
        publisher: null,
        publication_year: item.publication_year ?? null,
        isbn: null,
        pages: null,
        format: "Internet Archive text",
        source_refs: [source.id],
        confidence: 0.84
      });
    }

    contributions = contributions.filter((contribution) => !(contribution.source_refs || []).includes(source.id));
    contributors.forEach((contributor, index) => {
      contributions.push({
        id: `contrib_ia_verified_${hash(`${targetWork.id}|${authorIds[index]}|${contributor.role || "author"}|${source.id}`)}`,
        work_id: targetWork.id,
        edition_id: null,
        author_id: authorIds[index],
        role: contributor.role || "author",
        source_refs: [source.id],
        confidence: 0.84
      });
    });

    verifiedCount += 1;
  }
}

const sourceIdsWithRecords = new Set([
  ...works.flatMap((work) => work.source_refs || []),
  ...editions.flatMap((edition) => edition.source_refs || []),
  ...contributions.flatMap((contribution) => contribution.source_refs || [])
]);

works = works.filter((work) => (work.source_refs || []).length || editions.some((edition) => edition.work_id === work.id) || contributions.some((contribution) => contribution.work_id === work.id));
authors = Array.from(authorById.values());
sources = sources.map((source) => source);

writeJsonl(paths.sources, sources);
writeJsonl(paths.authors, authors);
writeJsonl(paths.works, works);
writeJsonl(paths.editions, editions);
writeJsonl(paths.contributions, contributions);

console.log(
  JSON.stringify(
    {
      verified_items_applied: verifiedCount,
      rejected_or_not_book_items_marked: rejectedCount,
      manual_review_items_marked: manualCount,
      referenced_source_records: sourceIdsWithRecords.size
    },
    null,
    2
  )
);
