const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { root, mainDir, candidatesDir } = require("./paths");
const { readJsonl } = require("./jsonl-store");

const outputPath = path.join(candidatesDir, "books.jsonl");
const archiveOutputDir = path.join(candidatesDir, "archive");
const archiveManifestPath = path.join(candidatesDir, "archive-manifest.json");
const duplicateReviewsPath = path.join(mainDir, "candidate_duplicate_reviews.jsonl");
const checkMode = process.argv.includes("--check");

function hash(value) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 16);
}

function stableJsonl(rows) {
  return rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function hasBanglaScript(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

function hasLatinScript(value) {
  return /[A-Za-z]/.test(String(value || ""));
}

function normalizedTextKey(value) {
  return cleanText(value)
    ?.toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
    .trim() || null;
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

function sourceLabel(row, titles) {
  return row.source || "Archive scrape";
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
        mtime: fs.existsSync(manifestPath) ? fs.statSync(manifestPath).mtimeMs : fs.statSync(dir).mtimeMs
      };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return runs[0] || null;
}

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(entryPath, predicate);
    return entry.isFile() && predicate(entryPath, entry.name) ? [entryPath] : [];
  });
}

function archiveCandidateFiles(run, sourceSlug) {
  if (sourceSlug === "rokomari-live") {
    return [path.join(run.dir, "books.jsonl")].filter((filePath) => fs.existsSync(filePath));
  }
  return walkFiles(run.dir, (_filePath, name) => name === "books.jsonl");
}

const archiveCandidateSources = [
  "small-islamic-sources",
  "medium-retailer-sources",
  "strong-retailer-sources",
  "granthagara",
  "wikimedia-bengali-scans",
  "rokomari-live"
];

function splitPipeLocalized(value) {
  const text = cleanText(value);
  if (!text || !text.includes("|")) return null;
  const parts = text.split(/\s*\|\s*/).map(cleanText).filter(Boolean);
  if (parts.length < 2) return null;

  const bn = parts.find((part) => hasBanglaScript(part)) || null;
  const en = parts.find((part) => hasLatinScript(part) && !hasBanglaScript(part)) || null;
  return bn || en ? { bn, en } : null;
}

function normalizeLocalizedPair(nameBn, nameEn) {
  const bn = cleanText(nameBn);
  const en = cleanText(nameEn);
  const split = splitPipeLocalized(bn) || splitPipeLocalized(en);

  if (!split) {
    return { bn, en };
  }

  return {
    bn: split.bn || (bn && hasBanglaScript(bn) && !bn.includes("|") ? bn : null),
    en: en && !en.includes("|") && !hasBanglaScript(en) ? en : split.en
  };
}

function isBanglaWrittenBook(work) {
  return hasBanglaScript(work.title_bn || work.title_en);
}

function candidateReason(work, sources) {
  const sourceNames = Array.from(new Set(sources.map((source) => source.source || source.label?.split(":")[0]).filter(Boolean))).join(", ");
  if (needsArchiveVerification(work)) {
    const archiveStatuses = sources.map(archiveResearchStatus).filter(Boolean);
    if (archiveStatuses.includes("restricted_unverified")) {
      return "Internet Archive item was restricted or errored during the OCR/PDF research pass. Keep out of the public dataset until manually verified.";
    }
    if (archiveStatuses.includes("needs_manual_review")) {
      return "Internet Archive OCR/PDF was checked, but the clean bibliographic title/author still needs manual review before promotion.";
    }
    return "Internet Archive metadata looks like archive/file packaging, not a clean bibliographic record. Verify the PDF/OCR title page before promoting.";
  }
  if (isSingleArchiveSourceWork(work) && !hasNonArchiveSupport(work)) {
    return "Internet Archive is the only source reference for this book. Find a non-Archive supporting catalog/source before promoting.";
  }
  if (/internet archive/i.test(sourceNames)) {
    return "Internet Archive marks this as Bengali-language text, but the catalog title is romanized or English. Verify scan/OCR content before promoting.";
  }
  if (/open library/i.test(sourceNames)) {
    return "Open Library marks this as Bengali/Bengali-literature metadata, but the title is romanized or English. Verify editions/content before promoting.";
  }
  return "Source metadata suggests Bengali-language content, but the visible title is not Bangla script. Verify content before promoting.";
}

function archivePackagingSignal(value) {
  const text = cleanText(value);
  if (!text) return false;
  if (/^\p{Decimal_Number}+[.)।]*$/u.test(text)) return true;
  if (/\p{Decimal_Number}{1,2}[./-]\p{Decimal_Number}{1,2}[./-]\p{Decimal_Number}{2,4}/u.test(text)) return true;
  return /\.(?:pdf|epub|mobi)\b|(?:বইঃ|ডাউনলোড|নন-প্রফিট|পিডিএফ|প্রকাশকঃ|লেখক\s*\/\s*অনুবাদক|শিক্ষা\s*পরিবার)|\b(?:compressed|download|educarion|education|high[-\s]?quality|media|pdf|school|team|unmochon)\b/iu.test(text);
}

function archiveResearchStatus(source) {
  const match = String(source?.notes || "").match(/Archive candidate research:\s*([a-z_]+)/i);
  return match?.[1] || null;
}

function candidateResearchStatus(source) {
  const match = String(source?.notes || "").match(/Candidate source research:\s*([a-z_]+)/i);
  return match?.[1] || null;
}

const works = readJsonl(path.join(mainDir, "works.jsonl"));
const authors = readJsonl(path.join(mainDir, "authors.jsonl"));
const editions = readJsonl(path.join(mainDir, "editions.jsonl"));
const contributions = readJsonl(path.join(mainDir, "contributions.jsonl"));
const sourceRecords = readJsonl(path.join(mainDir, "source_records.jsonl"));
const duplicateReviews = readJsonl(duplicateReviewsPath);
const mainSourceUrls = new Set(sourceRecords.map((source) => cleanText(source.url)).filter(Boolean));
const suppressedReviewStatuses = new Set([
  "duplicate_of_main",
  "not_book",
  "not_bangla_book",
  "outside_scope",
  "out_of_scope",
  "archive_only_unverified",
  "title_script_unverified"
]);
const suppressedCandidateIds = new Set(
  duplicateReviews
    .filter((review) => suppressedReviewStatuses.has(cleanText(review.status)))
    .map((review) => cleanText(review.candidate_id))
    .filter(Boolean)
);

const authorsById = new Map(authors.map((author) => [author.id, author]));
const sourceById = new Map(sourceRecords.map((source) => [source.id, source]));
const editionsByWork = new Map();
const contributionsByWork = new Map();

for (const edition of editions) {
  const list = editionsByWork.get(edition.work_id) || [];
  list.push(edition);
  editionsByWork.set(edition.work_id, list);
}

for (const contribution of contributions) {
  const list = contributionsByWork.get(contribution.work_id) || [];
  list.push(contribution);
  contributionsByWork.set(contribution.work_id, list);
}

function authorSupportKey(work) {
  return (contributionsByWork.get(work.id) || [])
    .map((contribution) => authorsById.get(contribution.author_id))
    .filter(Boolean)
    .map((author) => normalizedTextKey(author.name_bn || author.name_en))
    .filter(Boolean)
    .sort()
    .join("|");
}

function workSupportKey(work) {
  const titleKey = normalizedTextKey(work.title_bn || work.title_en);
  const authorsKey = authorSupportKey(work);
  return titleKey && authorsKey ? `${titleKey}||${authorsKey}` : null;
}

const nonArchiveSupportKeys = new Set();

for (const work of works) {
  const sourceRecords = (work.source_refs || []).map((sourceRef) => sourceById.get(sourceRef)).filter(Boolean);
  if (!sourceRecords.some((source) => source.source !== "Internet Archive")) continue;
  const supportKey = workSupportKey(work);
  if (supportKey) nonArchiveSupportKeys.add(supportKey);
}

function makeArchiveCandidate(row, filePath, run, sourceSlug, index) {
  const url = cleanText(row.url);
  if (!url || mainSourceUrls.has(url)) return null;

  const titles = titlePairFromRow(row);
  if (!cleanText(titles.bn || titles.en)) return null;

  const relativeRawPath = path.relative(root, filePath).replaceAll("\\", "/");
  const sourceIdentity = `${sourceSlug}|${run.name}|${url}|${row.source_id || row.product_id || ""}`;
  const authors = contributorInput(row);
  const candidate = {
    id: `candidate_archive_${hash(sourceIdentity)}`,
    title_bn: titles.bn,
    title_en: titles.en,
    authors,
    verification_status: "pending",
    reason: `Scrape archive candidate from ${row.source || sourceSlug}; review before main promotion.`,
    archive_record_count: 1,
    archive_source_slugs: [sourceSlug],
    raw_path: relativeRawPath,
    sources: [
      {
        label: sourceLabel(row, titles),
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
      rows.forEach((row, index) => {
        const url = cleanText(row.url);
        if (!url || seenUrls.has(url)) return;
        const candidate = makeArchiveCandidate(row, filePath, run, sourceSlug, index);
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

  return Array.from(groups.values()).filter((candidate) => !suppressedCandidateIds.has(candidate.id));
}

function isSingleArchiveSourceWork(work) {
  const sourceRecords = (work.source_refs || []).map((sourceRef) => sourceById.get(sourceRef)).filter(Boolean);
  return sourceRecords.length === 1 && sourceRecords[0].source === "Internet Archive";
}

function hasNonArchiveSupport(work) {
  const supportKey = workSupportKey(work);
  return supportKey ? nonArchiveSupportKeys.has(supportKey) : false;
}

function needsArchiveVerification(work) {
  const sourceRecords = (work.source_refs || []).map((sourceRef) => sourceById.get(sourceRef)).filter(Boolean);
  const archiveSources = sourceRecords.filter((source) => source.source === "Internet Archive");
  if (!archiveSources.length) return false;
  if (sourceRecords.some((source) => source.source !== "Internet Archive")) return false;
  if (archiveSources.every((source) => archiveResearchStatus(source) === "verified_book")) return false;
  return archiveSources.some((source) => archivePackagingSignal(source.raw_title) || archivePackagingSignal(source.raw_author));
}

function isRejectedArchiveCandidate(work) {
  const sourceRecords = (work.source_refs || []).map((sourceRef) => sourceById.get(sourceRef)).filter(Boolean);
  if (!sourceRecords.length || sourceRecords.some((source) => source.source !== "Internet Archive")) return false;
  const statuses = sourceRecords.map(archiveResearchStatus).filter(Boolean);
  return statuses.length > 0 && statuses.every((status) => status === "not_book" || status === "not_bangla_book");
}

function isRejectedSourceCandidate(work) {
  const sourceRecords = (work.source_refs || []).map((sourceRef) => sourceById.get(sourceRef)).filter(Boolean);
  if (!sourceRecords.length) return false;
  const statuses = sourceRecords.map(candidateResearchStatus).filter(Boolean);
  return statuses.length > 0 && statuses.every((status) => status === "not_book" || status === "not_bangla_book");
}

function isSupportedSourceCandidate(work) {
  const sourceRecords = (work.source_refs || []).map((sourceRef) => sourceById.get(sourceRef)).filter(Boolean);
  if (!sourceRecords.length) return false;
  const statuses = sourceRecords.map(candidateResearchStatus).filter(Boolean);
  return statuses.length > 0 && statuses.every((status) => status === "supported_book");
}

const mainCandidateRows = works
  .filter(
    (work) =>
      work.language === "bn" &&
      !isRejectedArchiveCandidate(work) &&
      !isRejectedSourceCandidate(work) &&
      !isSupportedSourceCandidate(work) &&
      (!isBanglaWrittenBook(work) ||
        needsArchiveVerification(work) ||
        (isSingleArchiveSourceWork(work) && !hasNonArchiveSupport(work)))
  )
  .map((work) => {
    const workEditions = editionsByWork.get(work.id) || [];
    const workContributions = contributionsByWork.get(work.id) || [];
    const sourceRefs = Array.from(
      new Set([
        ...(work.source_refs || []),
        ...workEditions.flatMap((edition) => edition.source_refs || []),
        ...workContributions.flatMap((contribution) => contribution.source_refs || [])
      ])
    );
    const sources = sourceRefs
      .map((sourceRef) => sourceById.get(sourceRef))
      .filter(Boolean)
      .map((source) => ({
        label: source.raw_title ? `${source.source}: ${source.raw_title}` : source.source,
        url: source.url || "",
        retrieved_at: source.retrieved_at,
        notes: source.notes || `${source.record_type} source record from ${source.source}.`
      }));
    const candidateAuthors = workContributions.map((contribution) => {
      const author = authorsById.get(contribution.author_id);
      const names = normalizeLocalizedPair(author?.name_bn, author?.name_en);
      return {
        id: contribution.author_id,
        name_bn: names.bn,
        name_en: names.en,
        role: contribution.role || "author"
      };
    });
    const titles = normalizeLocalizedPair(work.title_bn, work.title_en);

    return {
      id: `candidate_${work.id}`,
      normalized_work_id: work.id,
      title_bn: titles.bn,
      title_en: titles.en,
      authors: candidateAuthors,
      language: work.language,
      first_published_year: work.first_published_year || null,
      edition_count: workEditions.length,
      source_refs: sourceRefs,
      confidence: Math.min(work.confidence || 0.6, 0.78),
      verification_status: "pending",
      reason: candidateReason(work, sources),
      sources
    };
  })
  .filter((candidate) => cleanText(candidate.title_bn || candidate.title_en) && candidate.sources.length > 0)
  .filter((candidate) => !suppressedCandidateIds.has(candidate.id))
  .sort((a, b) => (a.title_bn || a.title_en || a.id).localeCompare(b.title_bn || b.title_en || b.id, ["bn", "en"], { numeric: true }));

const archiveCandidateRows = archiveCandidatesFromScrapes();
const candidateRows = mainCandidateRows.sort((a, b) =>
  (a.title_bn || a.title_en || a.id).localeCompare(b.title_bn || b.title_en || b.id, ["bn", "en"], { numeric: true })
);

function writeOrCheckFile(filePath, contents) {
  if (checkMode) {
    const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
    if (current !== contents) {
      console.error(`Generated candidate file is stale: ${path.relative(root, filePath)}`);
      process.exit(1);
    }
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

function archiveShardKey(candidate) {
  const parts = String(candidate.raw_path || "").split("/");
  const sourceSlug = parts[1] || "unknown";
  const subsource = parts.length > 4 ? parts[3] : "root";
  return `${sourceSlug}/${subsource}`;
}

function archiveShardPath(shardKey) {
  return path.join(archiveOutputDir, ...shardKey.split("/")) + ".jsonl";
}

function walkJsonlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkJsonlFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".jsonl") ? [entryPath] : [];
  });
}

function writeOrCheckArchiveCandidateShards(rows) {
  const shards = new Map();
  for (const row of rows) {
    const shardKey = archiveShardKey(row);
    const list = shards.get(shardKey) || [];
    list.push(row);
    shards.set(shardKey, list);
  }

  const manifest = {
    generated_at: new Date().toISOString().slice(0, 10),
    total: rows.length,
    notes:
      "Archive-derived scrape candidates are sharded because the full scrape candidate set is too large for one GitHub-friendly generated file.",
    shards: Array.from(shards.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([shardKey, shardRows]) => ({
        path: path.relative(candidatesDir, archiveShardPath(shardKey)).replaceAll("\\", "/"),
        count: shardRows.length
      }))
  };

  const expectedFiles = new Set(manifest.shards.map((shard) => path.normalize(path.join(candidatesDir, shard.path))));
  if (checkMode) {
    for (const existingFile of walkJsonlFiles(archiveOutputDir)) {
      if (!expectedFiles.has(path.normalize(existingFile))) {
        console.error(`Generated archive candidate shard is stale: ${path.relative(root, existingFile)}`);
        process.exit(1);
      }
    }
  } else if (fs.existsSync(archiveOutputDir)) {
    fs.rmSync(archiveOutputDir, { recursive: true, force: true });
  }

  for (const [shardKey, shardRows] of Array.from(shards.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    writeOrCheckFile(archiveShardPath(shardKey), stableJsonl(shardRows));
  }
  writeOrCheckFile(archiveManifestPath, stableJson(manifest));
  return manifest;
}

const output = stableJsonl(candidateRows);
writeOrCheckFile(outputPath, output);
const archiveManifest = writeOrCheckArchiveCandidateShards(archiveCandidateRows);

if (checkMode) {
  console.log("Candidate files are up to date.");
} else {
  console.log(
    `Generated ${candidateRows.length} candidate book record(s) plus ${archiveManifest.total} archive scrape candidate record(s) in ${archiveManifest.shards.length} shard(s).`
  );
  console.log(`Wrote ${path.relative(root, outputPath)}`);
  console.log(`Wrote ${path.relative(root, archiveManifestPath)}`);
}
