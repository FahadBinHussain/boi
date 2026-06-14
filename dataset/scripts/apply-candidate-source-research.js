const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { root, archiveDir, tables: paths } = require("./paths");
const { readJsonl } = require("./jsonl-store");

const researchDir = path.join(archiveDir, "candidate_source_research");

function selectedResearchFiles() {
  const args = process.argv.slice(2);
  const files = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--file" || arg === "-f") {
      const value = args[index + 1];
      if (!value) throw new Error(`${arg} requires a file name`);
      files.push(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--file=")) {
      files.push(arg.slice("--file=".length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return files.length ? files : null;
}

const requestedResearchFiles = selectedResearchFiles();

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

function hasBanglaScript(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function readResearchFiles() {
  if (!fs.existsSync(researchDir)) return [];

  const entries = requestedResearchFiles
    ? requestedResearchFiles.map((fileName) => {
        const filePath = path.resolve(researchDir, fileName);
        const relativePath = path.relative(researchDir, filePath);
        if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
          throw new Error(`Research file must be inside ${researchDir}: ${fileName}`);
        }
        return { fileName: relativePath, filePath };
      })
    : fs
        .readdirSync(researchDir)
        .filter((fileName) => fileName.endsWith(".json"))
        .sort()
        .map((fileName) => ({ fileName, filePath: path.join(researchDir, fileName) }));

  return entries.flatMap(({ fileName, filePath }) => {
    if (!fileName.endsWith(".json")) {
      throw new Error(`Research file must be JSON: ${fileName}`);
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return (data.items || []).map((item) => ({
      ...item,
      retrieved_at: data.generated_at || "2026-05-22",
      raw_path: path.relative(root, filePath).replaceAll("\\", "/")
    }));
  });
}

function researchNote(item) {
  return `Candidate source research: ${item.status}. ${item.evidence}`;
}

function mergeNotes(previous, next) {
  const base = cleanText(previous);
  if (!base) return next;
  const withoutOld = base.replace(/\s*Candidate source research: .*$/u, "").trim();
  return `${withoutOld} ${next}`.trim();
}

function stripCandidateResearchNote(value) {
  return cleanText(value)?.replace(/\s*Candidate source research: .*$/u, "").trim() || null;
}

function isAggregateSource(source) {
  return source?.record_type === "dataset";
}

function sourceIdentity(input) {
  return key(`${input.source || ""}|${input.url || ""}|${input.external_id || ""}|${input.raw_title || ""}`);
}

function sourceRefsForWork(workId) {
  const refs = new Set();
  const work = workById.get(workId);
  for (const ref of work?.source_refs || []) refs.add(ref);
  for (const edition of editions) {
    if (edition.work_id !== workId) continue;
    for (const ref of edition.source_refs || []) refs.add(ref);
  }
  for (const contribution of contributions) {
    if (contribution.work_id !== workId) continue;
    for (const ref of contribution.source_refs || []) refs.add(ref);
  }
  return Array.from(refs);
}

function markExistingSources(item) {
  for (const sourceRef of sourceRefsForWork(item.work_id)) {
    const source = sourceById.get(sourceRef);
    if (!source) continue;
    if (isAggregateSource(source)) {
      source.notes = stripCandidateResearchNote(source.notes);
      continue;
    }
    source.notes = mergeNotes(source.notes, researchNote(item));
  }
}

function candidateSourceIdsForItem(item) {
  return (item.sources || [])
    .map((source) => {
      const identity = sourceIdentity(source);
      return identity ? sourceIdentityToId.get(identity) : null;
    })
    .filter((sourceId) => {
      const source = sourceId ? sourceById.get(sourceId) : null;
      return source?.id?.startsWith("source_candidate_research_") && source.raw_path === item.raw_path;
    });
}

function restoreArchiveContributionIfNeeded(item) {
  if (contributions.some((contribution) => contribution.work_id === item.work_id)) return;

  const archiveSource = sourceRefsForWork(item.work_id)
    .map((sourceRef) => sourceById.get(sourceRef))
    .find((source) => source?.source === "Internet Archive" && cleanText(source.raw_author));
  if (!archiveSource) return;

  const rawAuthor = cleanText(archiveSource.raw_author);
  const authorId = ensureAuthor(
    {
      name_bn: hasBanglaScript(rawAuthor) ? rawAuthor : null,
      name_en: hasBanglaScript(rawAuthor) ? null : rawAuthor,
      role: "author"
    },
    [archiveSource.id]
  );
  const edition = editions.find((row) => row.work_id === item.work_id);
  contributions.push({
    id: `contrib_candidate_research_restored_${hash(`${item.work_id}|${authorId}|${archiveSource.id}`)}`,
    work_id: item.work_id,
    edition_id: edition?.id || null,
    author_id: authorId,
    role: "author",
    source_refs: [archiveSource.id],
    confidence: 0.76,
    aliases: []
  });
}

function removeCandidateSourceSupport(item) {
  const sourceIds = candidateSourceIdsForItem(item);
  if (!sourceIds.length) return;

  const sourceIdSet = new Set(sourceIds);
  const work = workById.get(item.work_id);
  if (work) {
    work.source_refs = (work.source_refs || []).filter((sourceRef) => !sourceIdSet.has(sourceRef));
  }

  for (const edition of editions) {
    if (edition.work_id !== item.work_id) continue;
    edition.source_refs = (edition.source_refs || []).filter((sourceRef) => !sourceIdSet.has(sourceRef));
  }

  contributions = contributions.filter(
    (contribution) =>
      contribution.work_id !== item.work_id || !(contribution.source_refs || []).some((sourceRef) => sourceIdSet.has(sourceRef))
  );

  for (const author of authorById.values()) {
    author.source_refs = (author.source_refs || []).filter((sourceRef) => !sourceIdSet.has(sourceRef));
  }

  for (const sourceId of sourceIds) {
    sourceById.delete(sourceId);
  }

  restoreArchiveContributionIfNeeded(item);
}

function cleanupDanglingSourceRefs() {
  const validSourceIds = new Set(sourceById.keys());
  for (const row of [...workById.values(), ...editions, ...contributions, ...authorById.values()]) {
    if (!Array.isArray(row.source_refs)) continue;
    row.source_refs = row.source_refs.filter((sourceRef) => validSourceIds.has(sourceRef));
  }
}

function ensureSource(input, item) {
  const identity = sourceIdentity(input);
  const existingId = identity ? sourceIdentityToId.get(identity) : null;
  const id = existingId || `source_candidate_research_${hash(`${item.work_id}|${identity || input.source || ""}|${input.url || ""}|${input.external_id || ""}|${input.raw_title || ""}`)}`;
  const previous = sourceById.get(id);
  const row = {
    id,
    source: cleanText(input.source) || "Candidate source research",
    url: cleanText(input.url),
    retrieved_at: item.retrieved_at,
    raw_path: item.raw_path,
    external_id: cleanText(input.external_id),
    record_type: cleanText(input.record_type) || "book",
    raw_title: cleanText(input.raw_title || item.title_bn || item.title_en),
    raw_author: cleanText(input.raw_author || (item.authors || []).map((author) => author.name_bn || author.name_en).filter(Boolean).join(", ")),
    notes: mergeNotes(input.notes || previous?.notes, researchNote(item)),
    aliases: previous?.aliases || [],
    source_refs: previous?.source_refs || []
  };

  sourceById.set(id, row);
  if (!sources.some((source) => source.id === id)) sources.push(row);
  if (identity) sourceIdentityToId.set(identity, id);
  return id;
}

function authorInputKey(input) {
  return key(input.name_bn || input.name_en);
}

function ensureAuthor(input, sourceIds) {
  const nameKey = authorInputKey(input);
  const id = (nameKey && authorKeyToId.get(nameKey)) || `author_candidate_research_${hash(input.name_bn || input.name_en)}`;
  if (nameKey) authorKeyToId.set(nameKey, id);

  const previous = authorById.get(id);
  const row = {
    id,
    name_bn: cleanText(input.name_bn) ?? previous?.name_bn ?? null,
    name_en: cleanText(input.name_en) ?? previous?.name_en ?? null,
    aliases: Array.from(new Set([...(previous?.aliases || []), ...(input.aliases || [])].filter(Boolean))),
    birth_year: previous?.birth_year ?? null,
    death_year: previous?.death_year ?? null,
    country_or_region: previous?.country_or_region ?? null,
    notes: previous?.notes ?? null,
    source_refs: Array.from(new Set([...(previous?.source_refs || []), ...sourceIds])),
    confidence: Math.max(previous?.confidence || 0, 0.84)
  };

  authorById.set(id, row);
  if (!authors.some((author) => author.id === id)) authors.push(row);
  return id;
}

function applySupportedBook(item) {
  const work = workById.get(item.work_id);
  if (!work) return false;

  const sourceIds = (item.sources || []).map((source) => ensureSource(source, item));
  if (!sourceIds.length) return false;

  work.title_bn = cleanText(item.title_bn) ?? work.title_bn ?? null;
  work.title_en = cleanText(item.title_en) ?? work.title_en ?? null;
  work.language = "bn";
  work.first_published_year = item.publication_year ?? work.first_published_year ?? null;
  work.source_refs = Array.from(new Set([...(work.source_refs || []), ...sourceIds]));
  work.confidence = Math.max(work.confidence || 0, 0.84);

  const editionInput = item.edition || {};
  const workEditions = editions.filter((edition) => edition.work_id === work.id);
  const edition = workEditions[0] || {
    id: `edition_candidate_research_${hash(`${work.id}|${sourceIds.join("|")}`)}`,
    work_id: work.id,
    title_as_printed: work.title_bn || work.title_en,
    publisher: null,
    publication_year: null,
    isbn: null,
    pages: null,
    format: "book",
    source_refs: [],
    confidence: 0
  };

  edition.title_as_printed = cleanText(editionInput.title_as_printed || item.title_bn || item.title_en) ?? edition.title_as_printed;
  edition.publisher = cleanText(editionInput.publisher) ?? edition.publisher ?? null;
  edition.publication_year = editionInput.publication_year ?? item.publication_year ?? edition.publication_year ?? null;
  edition.isbn = editionInput.isbn ?? edition.isbn ?? null;
  edition.pages = editionInput.pages ?? edition.pages ?? null;
  edition.format = cleanText(editionInput.format) ?? edition.format ?? "book";
  edition.source_refs = Array.from(new Set([...(edition.source_refs || []), ...sourceIds]));
  edition.confidence = Math.max(edition.confidence || 0, 0.84);
  if (!editions.some((existing) => existing.id === edition.id)) editions.push(edition);

  const authorIds = (item.authors || []).map((author) => ensureAuthor(author, sourceIds));
  const contributionAuthors = [];
  for (const [index, authorId] of authorIds.entries()) {
    const author = item.authors[index];
    const role = author.role || "author";
    const key = `${authorId}|${role}`;
    if (contributionAuthors.some((entry) => entry.key === key)) continue;
    contributionAuthors.push({ author, authorId, role, key });
  }
  if (contributionAuthors.length) {
    contributions = contributions.filter((contribution) => contribution.work_id !== work.id);
    contributionAuthors.forEach(({ authorId, role }) => {
      contributions.push({
        id: `contrib_candidate_research_${hash(`${work.id}|${authorId}|${role}`)}`,
        work_id: work.id,
        edition_id: edition.id,
        author_id: authorId,
        role,
        source_refs: sourceIds,
        confidence: 0.84,
        aliases: []
      });
    });
  }

  return true;
}

let sources = readJsonl(paths.sources);
let authors = readJsonl(paths.authors);
let works = readJsonl(paths.works);
let editions = readJsonl(paths.editions);
let contributions = readJsonl(paths.contributions);

const sourceById = new Map(sources.map((source) => [source.id, source]));
const workById = new Map(works.map((work) => [work.id, work]));
const authorById = new Map(authors.map((author) => [author.id, author]));
const authorKeyToId = new Map();
const sourceIdentityToId = new Map();

for (const author of authors) {
  const nameKey = key(author.name_bn || author.name_en);
  if (nameKey) authorKeyToId.set(nameKey, author.id);
}

for (const source of sources) {
  const identity = sourceIdentity(source);
  if (identity) sourceIdentityToId.set(identity, source.id);
}

const research = readResearchFiles();
let supportedCount = 0;
let rejectedCount = 0;
let manualCount = 0;
let missingCount = 0;

for (const item of research) {
  if (!workById.has(item.work_id)) {
    missingCount += 1;
    continue;
  }

  if (item.status !== "supported_book") {
    removeCandidateSourceSupport(item);
  }

  markExistingSources(item);

  if (item.status === "supported_book") {
    if (applySupportedBook(item)) supportedCount += 1;
    else manualCount += 1;
    continue;
  }

  if (item.status === "needs_manual_review" || item.status === "restricted_unverified") {
    manualCount += 1;
  } else {
    rejectedCount += 1;
  }
}

authors = Array.from(authorById.values());
sources = Array.from(sourceById.values());
works = Array.from(workById.values());
cleanupDanglingSourceRefs();

writeJsonl(paths.sources, sources);
writeJsonl(paths.authors, authors);
writeJsonl(paths.works, works);
writeJsonl(paths.editions, editions);
writeJsonl(paths.contributions, contributions);

console.log(
  JSON.stringify(
    {
      research_items: research.length,
      supported_books_applied: supportedCount,
      rejected_items_marked: rejectedCount,
      manual_review_items_marked: manualCount,
      missing_work_items: missingCount
    },
    null,
    2
  )
);
