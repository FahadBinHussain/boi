const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { archiveDir, tables } = require("./paths");
const { readJsonl, writeJsonl } = require("./jsonl-store");

const runId = process.env.BANGLABOIPDF_RUN_ID || null;
const researchId = process.env.BANGLABOIPDF_ROKOMARI_RESEARCH_ID || null;
const retrievedAt = process.env.DATASET_RETRIEVED_AT || new Date().toISOString().slice(0, 10);
const excludedSourceIds = new Set(
  (process.env.BANGLABOIPDF_ROKOMARI_EXCLUDE_SOURCE_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s'",]+|[\s'",]+$/g, "")
    .trim();
  return text || null;
}

function hash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 14);
}

function key(value) {
  return cleanText(value)
    ?.toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

const genericAuthorPattern = /\b(?:author|authors|various|various writers?|various author|unknown|compiled|collection)\b/i;

function isGenericAuthor(value) {
  const text = cleanText(value);
  return !text || genericAuthorPattern.test(text);
}

function mergeArrays(previous = [], next = []) {
  return unique([...(Array.isArray(previous) ? previous : []), ...(Array.isArray(next) ? next : [])]);
}

function mergeNotes(previous, next) {
  const oldNote = cleanText(previous);
  const newNote = cleanText(next);
  if (!oldNote) return newNote;
  if (!newNote || oldNote.includes(newNote)) return oldNote;
  return `${oldNote} ${newNote}`;
}

function parseRokomariId(urlOrPath) {
  const match = String(urlOrPath || "").match(/\/book\/(\d+)(?:\/|$)/);
  return match ? match[1] : null;
}

function latestRunDir() {
  const root = path.join(archiveDir, "banglaboipdf");
  const runs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, "books.jsonl")))
    .map((entry) => ({
      name: entry.name,
      dir: path.join(root, entry.name),
      mtime: fs.statSync(path.join(root, entry.name, "books.jsonl")).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!runs.length) throw new Error(`No BanglaBoiPDF archive run found in ${root}`);
  return runs[0];
}

function selectedRunDir() {
  if (!runId) return latestRunDir();
  const dir = path.join(archiveDir, "banglaboipdf", runId);
  if (!fs.existsSync(path.join(dir, "books.jsonl"))) throw new Error(`No books.jsonl in ${dir}`);
  return { name: runId, dir };
}

function latestResearchDir(runDir) {
  const root = path.join(runDir, "rokomari-research");
  const runs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, "items.jsonl")))
    .map((entry) => ({
      name: entry.name,
      dir: path.join(root, entry.name),
      mtime: fs.statSync(path.join(root, entry.name, "manifest.json")).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!runs.length) throw new Error(`No BanglaBoiPDF Rokomari research run found in ${root}`);
  return runs[0];
}

function selectedResearchDir(runDir) {
  if (!researchId) return latestResearchDir(runDir);
  const dir = path.join(runDir, "rokomari-research", researchId);
  if (!fs.existsSync(path.join(dir, "items.jsonl"))) throw new Error(`No items.jsonl in ${dir}`);
  return { name: researchId, dir };
}

function banglaboipdfAliases(item) {
  return unique([
    item.banglaboipdf?.title,
    ...(item.banglaboipdf?.title_variants || []),
    item.banglaboipdf?.raw_title,
    item.banglaboipdf?.source_title
  ]);
}

function sourceAuthorAliases(item) {
  return unique([item.banglaboipdf?.source_author]).filter((author) => !isGenericAuthor(author));
}

function sourceRawAuthor(item) {
  return cleanText(item.banglaboipdf?.source_author);
}

function banglaboipdfNotes(item, research) {
  const pieces = [`BanglaBoiPDF WordPress catalog metadata; no book files downloaded. Rokomari-supported research: ${research.name}.`];
  const categories = item.banglaboipdf?.categories || [];
  const tags = item.banglaboipdf?.tags || [];
  if (categories.length) pieces.push(`categories: ${categories.join("; ")}`);
  if (tags.length) pieces.push(`tags: ${tags.join("; ")}`);
  if (item.banglaboipdf?.pages) pieces.push(`source_pages: ${item.banglaboipdf.pages}`);
  if (item.banglaboipdf?.pdf_size) pieces.push(`source_pdf_size: ${item.banglaboipdf.pdf_size}`);
  if (item.banglaboipdf?.editor_or_translator) pieces.push(`editor_or_translator: ${item.banglaboipdf.editor_or_translator}`);
  return pieces.join(" ");
}

function rokomariNotes(product, research) {
  const pieces = [`Live Rokomari product page parsed for BanglaBoiPDF support research: ${research.name}.`];
  if (product.publisher) pieces.push(`publisher: ${product.publisher}`);
  if (product.edition) pieces.push(`edition: ${product.edition}`);
  if (product.pages) pieces.push(`pages: ${product.pages}`);
  if (product.language) pieces.push(`language: ${product.language}`);
  if (product.translator) pieces.push(`translator: ${product.translator}`);
  if (product.editor) pieces.push(`editor: ${product.editor}`);
  return pieces.join(" ");
}

function sourceIdForRokomari(product) {
  return `source_rokomari_book_${product.product_id}`;
}

function sourceIdForBanglaBoiPDF(item) {
  return `source_banglaboipdf_wp_${item.source_id}`;
}

function mergeSource(sourcesById, input) {
  const previous = sourcesById.get(input.id);
  sourcesById.set(input.id, {
    ...(previous || {}),
    id: input.id,
    source: previous?.source || input.source,
    url: previous?.url || input.url,
    retrieved_at: previous?.retrieved_at || input.retrieved_at,
    raw_path: previous?.raw_path || input.raw_path || null,
    external_id: previous?.external_id || input.external_id || null,
    record_type: previous?.record_type || input.record_type,
    raw_title: previous?.raw_title || input.raw_title || null,
    raw_author: previous?.raw_author || input.raw_author || null,
    notes: mergeNotes(previous?.notes, input.notes),
    aliases: mergeArrays(previous?.aliases, input.aliases),
    source_refs: mergeArrays(previous?.source_refs, input.source_refs)
  });
  return input.id;
}

function authorIdFor(product, authorsById, authorIdByKey) {
  const rokomariId = product.author_id ? `author_rokomari_${product.author_id}` : null;
  if (rokomariId && authorsById.has(rokomariId)) return rokomariId;
  const authorKey = key(product.author_bn || product.author_en);
  if (authorKey && authorIdByKey.has(authorKey)) return authorIdByKey.get(authorKey);
  return rokomariId || `author_banglaboipdf_rokomari_${hash(product.author_bn || product.author_en || product.product_id)}`;
}

function mergeAuthor(authorsById, authorIdByKey, product, item, sourceRefs) {
  const id = authorIdFor(product, authorsById, authorIdByKey);
  const previous = authorsById.get(id);
  const row = {
    ...(previous || {}),
    id,
    name_bn: previous?.name_bn || product.author_bn || null,
    name_en: previous?.name_en || product.author_en || null,
    aliases: mergeArrays(previous?.aliases, [product.author_en, ...sourceAuthorAliases(item)]),
    birth_year: previous?.birth_year ?? null,
    death_year: previous?.death_year ?? null,
    country_or_region: previous?.country_or_region ?? null,
    notes: previous?.notes ?? null,
    source_refs: mergeArrays(previous?.source_refs, sourceRefs),
    confidence: Math.max(previous?.confidence || 0, 0.86)
  };
  authorsById.set(id, row);
  for (const name of [row.name_bn, row.name_en, ...(row.aliases || [])]) {
    const authorKey = key(name);
    if (authorKey && !authorIdByKey.has(authorKey)) authorIdByKey.set(authorKey, id);
  }
  return id;
}

function buildWorkIdBySource(worksById, editionsById) {
  const map = new Map();
  for (const work of worksById.values()) {
    for (const sourceRef of work.source_refs || []) map.set(sourceRef, work.id);
  }
  for (const edition of editionsById.values()) {
    for (const sourceRef of edition.source_refs || []) {
      if (!map.has(sourceRef)) map.set(sourceRef, edition.work_id);
    }
  }
  return map;
}

function contributionAuthorKeysByWork(contributionsById, authorsById) {
  const map = new Map();
  for (const contribution of contributionsById.values()) {
    const author = authorsById.get(contribution.author_id);
    const names = [author?.name_bn, author?.name_en, ...(author?.aliases || [])];
    const keys = unique(names.map(key));
    const list = map.get(contribution.work_id) || [];
    list.push(...keys);
    map.set(contribution.work_id, unique(list));
  }
  return map;
}

function findExistingWorkByTitleAuthor(product, worksById, contributionsById, authorsById) {
  const productTitleKeys = new Set(unique([product.title_bn, product.title_en].map(key)));
  const productAuthorKeys = new Set(unique([product.author_bn, product.author_en].map(key)));
  if (!productTitleKeys.size || !productAuthorKeys.size) return null;
  const authorsByWork = contributionAuthorKeysByWork(contributionsById, authorsById);
  for (const work of worksById.values()) {
    const workTitleKeys = unique([work.title_bn, work.title_en, ...(work.aliases || [])].map(key));
    if (!workTitleKeys.some((titleKey) => productTitleKeys.has(titleKey))) continue;
    const workAuthorKeys = authorsByWork.get(work.id) || [];
    if (workAuthorKeys.some((authorKey) => productAuthorKeys.has(authorKey))) return work.id;
  }
  return null;
}

function workIdFor(item, product, sourceRefs, worksById, editionsById, contributionsById, authorsById, workIdBySource) {
  const existingMain = item.best_match?.existing_main?.work_id;
  if (existingMain && worksById.has(existingMain)) return existingMain;
  for (const sourceRef of sourceRefs) {
    const workId = workIdBySource.get(sourceRef);
    if (workId && worksById.has(workId)) return workId;
  }
  const rokomariWorkId = `work_rokomari_${product.product_id}`;
  if (worksById.has(rokomariWorkId)) return rokomariWorkId;
  const exactTitleAuthorWorkId = findExistingWorkByTitleAuthor(product, worksById, contributionsById, authorsById);
  if (exactTitleAuthorWorkId) return exactTitleAuthorWorkId;
  return rokomariWorkId;
}

function mergeWork(worksById, item, product, sourceRefs, workId) {
  const previous = worksById.get(workId);
  const aliases = [product.title_en, ...banglaboipdfAliases(item)].filter((alias) => alias && alias !== product.title_bn);
  const row = {
    ...(previous || {}),
    id: workId,
    title_bn: previous?.title_bn || product.title_bn || null,
    title_en: previous?.title_en || product.title_en || null,
    aliases: mergeArrays(previous?.aliases, aliases),
    language: previous?.language || "bn",
    genre: previous?.genre || product.category_bn || product.category_en || item.banglaboipdf?.categories?.[0] || null,
    first_published_year: previous?.first_published_year ?? product.publication_year ?? null,
    source_refs: mergeArrays(previous?.source_refs, sourceRefs),
    confidence: Math.max(previous?.confidence || 0, 0.86)
  };
  worksById.set(workId, row);
  return workId;
}

function mergeEdition(editionsById, product, item, workId, sourceRefs) {
  const id = `edition_rokomari_${product.product_id}`;
  const previous = editionsById.get(id);
  editionsById.set(id, {
    ...(previous || {}),
    id,
    work_id: workId,
    title_as_printed: previous?.title_as_printed || product.title_bn || product.title_en,
    publisher: previous?.publisher || product.publisher || null,
    publication_year: previous?.publication_year ?? product.publication_year ?? null,
    isbn: previous?.isbn || product.isbn || null,
    pages: previous?.pages || product.pages || item.banglaboipdf?.pages || null,
    format: previous?.format || "book",
    source_refs: mergeArrays(previous?.source_refs, sourceRefs),
    confidence: Math.max(previous?.confidence || 0, 0.84)
  });
  return id;
}

function mergeContribution(contributionsById, workId, editionId, authorId, sourceRefs) {
  const previous = Array.from(contributionsById.values()).find(
    (contribution) => contribution.work_id === workId && contribution.author_id === authorId && contribution.role === "author"
  );
  const id = previous?.id || `contrib_banglaboipdf_rokomari_${hash(`${workId}|${authorId}|author`)}`;
  contributionsById.set(id, {
    ...(previous || {}),
    id,
    work_id: workId,
    edition_id: previous?.edition_id || editionId || null,
    author_id: authorId,
    role: "author",
    source_refs: mergeArrays(previous?.source_refs, sourceRefs),
    confidence: Math.max(previous?.confidence || 0, 0.84)
  });
  return id;
}

function main() {
  const run = selectedRunDir();
  const research = selectedResearchDir(run.dir);
  const researchPath = path.join(research.dir, "items.jsonl");
  const rawPath = path.relative(archiveDir, researchPath).replaceAll("\\", "/");
  const sourceRawPath = path.relative(archiveDir, path.join(run.dir, "books.jsonl")).replaceAll("\\", "/");
  const items = readJsonl(researchPath).filter(
    (item) => ["verified_existing_main", "verified_new_main"].includes(item.status) && !excludedSourceIds.has(String(item.source_id))
  );

  const sourcesById = new Map(readJsonl(tables.sources).map((row) => [row.id, row]));
  const authorsById = new Map(readJsonl(tables.authors).map((row) => [row.id, row]));
  const worksById = new Map(readJsonl(tables.works).map((row) => [row.id, row]));
  const editionsById = new Map(readJsonl(tables.editions).map((row) => [row.id, row]));
  const contributionsById = new Map(readJsonl(tables.contributions).map((row) => [row.id, row]));
  const authorIdByKey = new Map();
  for (const author of authorsById.values()) {
    for (const name of [author.name_bn, author.name_en, ...(author.aliases || [])]) {
      const authorKey = key(name);
      if (authorKey && !authorIdByKey.has(authorKey)) authorIdByKey.set(authorKey, author.id);
    }
  }

  let linkedExistingWorks = 0;
  let newWorks = 0;
  const beforeWorkIds = new Set(worksById.keys());

  for (const item of items) {
    const product = item.best_match.product;
    const rokomariSourceId = mergeSource(sourcesById, {
      id: sourceIdForRokomari(product),
      source: "Rokomari",
      url: product.url,
      retrieved_at: retrievedAt,
      raw_path: rawPath,
      external_id: product.product_id,
      record_type: "book",
      raw_title: product.title_bn,
      raw_author: product.author_bn,
      notes: rokomariNotes(product, research),
      aliases: [product.title_en],
      source_refs: []
    });
    const banglaboipdfSourceId = mergeSource(sourcesById, {
      id: sourceIdForBanglaBoiPDF(item),
      source: "BanglaBoiPDF",
      url: item.banglaboipdf.url,
      retrieved_at: item.banglaboipdf.archive_record?.retrieved_at || retrievedAt,
      raw_path: sourceRawPath,
      external_id: String(item.source_id),
      record_type: "book",
      raw_title: item.banglaboipdf.raw_title || item.banglaboipdf.title,
      raw_author: sourceRawAuthor(item),
      notes: banglaboipdfNotes(item, research),
      aliases: banglaboipdfAliases(item),
      source_refs: [rokomariSourceId]
    });

    const sourceRefs = [rokomariSourceId, banglaboipdfSourceId];
    const authorId = mergeAuthor(authorsById, authorIdByKey, product, item, sourceRefs);
    const workIdBySource = buildWorkIdBySource(worksById, editionsById);
    const workId = workIdFor(item, product, sourceRefs, worksById, editionsById, contributionsById, authorsById, workIdBySource);
    mergeWork(worksById, item, product, sourceRefs, workId);
    const editionId = mergeEdition(editionsById, product, item, workId, [rokomariSourceId]);
    mergeContribution(contributionsById, workId, editionId, authorId, sourceRefs);

    if (beforeWorkIds.has(workId)) linkedExistingWorks += 1;
    else {
      newWorks += 1;
      beforeWorkIds.add(workId);
    }
  }

  writeJsonl(tables.sources, Array.from(sourcesById.values()));
  writeJsonl(tables.authors, Array.from(authorsById.values()));
  writeJsonl(tables.works, Array.from(worksById.values()));
  writeJsonl(tables.editions, Array.from(editionsById.values()));
  writeJsonl(tables.contributions, Array.from(contributionsById.values()));

  console.log(
    JSON.stringify(
      {
        research_id: research.name,
        applied_items: items.length,
        linked_existing_works: linkedExistingWorks,
        new_works: newWorks,
        excluded_source_ids: Array.from(excludedSourceIds),
        source_records: sourcesById.size,
        authors: authorsById.size,
        works: worksById.size,
        editions: editionsById.size,
        contributions: contributionsById.size
      },
      null,
      2
    )
  );
}

main();
