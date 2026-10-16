#!/usr/bin/env node
// Builds the SQLite database that backs the live /dataset page on Turso.
//
//   node dataset/scripts/build-dataset-db.mjs
//
// Output: dataset/main/generated/db/boi-dataset.db (+ db-manifest.json)
// The file is uploaded to Turso by dataset/scripts/upload-dataset-db.mjs.
//
// Sources (dataset/main is gitignored, restore it from the dataset backup first):
//   - generated/exports/works/pages/title/asc/*.json           -> dataset_works  (public books view)
//   - generated/exports/candidate-books/pages/title/asc/*.json -> dataset_candidates
//   - works/, editions/, contributions/, source_records/ paged jsonl dirs, root
//     <table>.jsonl fallback (authors.jsonl) -> raw tables. Mirrors
//     dataset/scripts/jsonl-store.js readJsonl(): the paged dir wins when it
//     exists, because the root jsonl files are stale leftovers.
//
// Every list row also gets the six keyset sort keys (see dataset-db-schema.mjs),
// and dataset_page_keys records the first key of every page so page jumps stay
// a single index lookup instead of an OFFSET scan.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import {
  CANDIDATES_PAGE_SIZE,
  DATASET_VIEWS,
  REFERENCES_PAGE_SIZE,
  SORT_DIRECTIONS,
  SORT_KEYS,
  SORT_KEY_COLUMNS,
  WORKS_PAGE_SIZE,
  keyForRank,
  pageStartRank,
  rankRows,
  sortKeyColumn,
} from './dataset-db-schema.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const mainDir = path.join(repoRoot, 'dataset', 'main');
const exportsDir = path.join(mainDir, 'generated', 'exports');
const outDir = path.join(mainDir, 'generated', 'db');
const dbPath = path.join(outDir, 'boi-dataset.db');

const started = Date.now();
const log = (...args) => console.log(`[dataset-db ${((Date.now() - started) / 1000).toFixed(1)}s]`, ...args);

function fail(message) {
  console.error(`\nFATAL: ${message}\n`);
  process.exit(1);
}

const worksViewColumns = [
  'id',
  'title_bn',
  'title_en',
  'first_published_year',
  'language',
  'genre',
  'confidence',
  'edition_count',
  'source_count',
  'aliases',
  'source_refs',
  'edition_source_refs',
  'authors',
  'extras',
  ...SORT_KEY_COLUMNS,
];

const candidateViewColumns = [
  'id',
  'normalized_work_id',
  'title_bn',
  'title_en',
  'first_published_year',
  'language',
  'confidence',
  'edition_count',
  'verification_status',
  'reason',
  'source_refs',
  'sources',
  'authors',
  'extras',
  ...SORT_KEY_COLUMNS,
];

// The export page files carry rare extra fields on top of the declared shape
// (2542 works rows carry `author_id`). They are kept in `extras` so the exported
// pages stay faithful instead of dropping them.
const WORKS_DECLARED_KEYS = new Set([
  'id',
  'title_bn',
  'title_en',
  'first_published_year',
  'language',
  'genre',
  'confidence',
  'edition_count',
  'source_count',
  'aliases',
  'source_refs',
  'edition_source_refs',
  'authors',
]);

const CANDIDATE_DECLARED_KEYS = new Set([
  'id',
  'normalized_work_id',
  'title_bn',
  'title_en',
  'first_published_year',
  'language',
  'confidence',
  'edition_count',
  'verification_status',
  'reason',
  'source_refs',
  'sources',
  'authors',
]);

function extrasFor(row, declaredKeys) {
  const extras = {};
  let count = 0;
  for (const [key, value] of Object.entries(row)) {
    if (declaredKeys.has(key)) continue;
    extras[key] = value;
    count += 1;
  }
  return count ? JSON.stringify(extras) : null;
}

fs.mkdirSync(outDir, { recursive: true });
for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
  if (fs.existsSync(file)) fs.rmSync(file);
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA page_size = 4096;');
db.exec('PRAGMA auto_vacuum = 0;');
db.exec('PRAGMA encoding = "UTF-8";');
db.exec('PRAGMA synchronous = OFF;');
db.exec('PRAGMA journal_mode = MEMORY;'); // build-only; switched to WAL before the file is exported
db.exec('PRAGMA temp_store = MEMORY;');

const keyColumnsSql = SORT_KEY_COLUMNS.map((column) => `  ${column} TEXT NOT NULL`).join(',\n');

log('creating schema');
db.exec(`
CREATE TABLE dataset_stats (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  updated_at TEXT NOT NULL,
  source_records INTEGER NOT NULL,
  authors_raw INTEGER NOT NULL,
  works_raw INTEGER NOT NULL,
  editions INTEGER NOT NULL,
  contributions INTEGER NOT NULL,
  works_view_total INTEGER NOT NULL,
  works_view_page_size INTEGER NOT NULL,
  works_view_page_count INTEGER NOT NULL,
  candidates_total INTEGER NOT NULL,
  candidates_page_size INTEGER NOT NULL,
  candidates_page_count INTEGER NOT NULL,
  references_page_size INTEGER NOT NULL,
  references_page_count INTEGER NOT NULL
);

CREATE TABLE dataset_works (
  id TEXT PRIMARY KEY,
  title_bn TEXT,
  title_en TEXT,
  first_published_year INTEGER,
  language TEXT,
  genre TEXT,
  confidence REAL,
  edition_count INTEGER NOT NULL,
  source_count INTEGER NOT NULL,
  aliases TEXT,
  source_refs TEXT NOT NULL,
  edition_source_refs TEXT NOT NULL,
  authors TEXT NOT NULL,
  extras TEXT,
${keyColumnsSql}
);

CREATE TABLE dataset_candidates (
  id TEXT PRIMARY KEY,
  normalized_work_id TEXT,
  title_bn TEXT,
  title_en TEXT,
  first_published_year INTEGER,
  language TEXT,
  confidence REAL,
  edition_count INTEGER NOT NULL,
  verification_status TEXT,
  reason TEXT,
  source_refs TEXT NOT NULL,
  sources TEXT NOT NULL,
  authors TEXT NOT NULL,
  extras TEXT,
${keyColumnsSql}
);

CREATE TABLE works (
  id TEXT PRIMARY KEY,
  title_bn TEXT,
  title_en TEXT,
  language TEXT,
  genre TEXT,
  first_published_year INTEGER,
  confidence REAL,
  aliases TEXT,
  source_refs TEXT
);

CREATE TABLE editions (
  id TEXT PRIMARY KEY,
  work_id TEXT,
  title_as_printed TEXT,
  publisher TEXT,
  publication_year INTEGER,
  isbn TEXT,
  pages INTEGER,
  format TEXT,
  confidence REAL,
  source_refs TEXT
);

CREATE TABLE authors (
  id TEXT PRIMARY KEY,
  name_bn TEXT,
  name_en TEXT,
  birth_year INTEGER,
  death_year INTEGER,
  country_or_region TEXT,
  notes TEXT,
  confidence REAL,
  aliases TEXT,
  source_refs TEXT
);

CREATE TABLE contributions (
  id TEXT PRIMARY KEY,
  work_id TEXT,
  edition_id TEXT,
  author_id TEXT,
  role TEXT,
  confidence REAL,
  aliases TEXT,
  source_refs TEXT
);

CREATE TABLE source_records (
  id TEXT PRIMARY KEY,
  source TEXT,
  url TEXT,
  retrieved_at TEXT,
  raw_path TEXT,
  external_id TEXT,
  record_type TEXT,
  raw_title TEXT,
  raw_author TEXT,
  notes TEXT,
  aliases TEXT,
  source_refs TEXT
);

CREATE TABLE dataset_page_keys (
  view TEXT NOT NULL,
  sort TEXT NOT NULL,
  direction TEXT NOT NULL,
  page INTEGER NOT NULL,
  key TEXT NOT NULL,
  PRIMARY KEY (view, sort, direction, page)
);

CREATE TABLE dataset_export_files (
  name TEXT PRIMARY KEY,
  bytes INTEGER NOT NULL,
  encoding TEXT NOT NULL,
  content BLOB NOT NULL
);
`);

function makeInserter(sql, batchSize = 5000) {
  const statement = db.prepare(sql);
  let count = 0;
  let pending = 0;
  let open = false;
  return {
    run(values) {
      if (!open) {
        db.exec('BEGIN');
        open = true;
      }
      statement.run(...values);
      count += 1;
      pending += 1;
      if (pending >= batchSize) {
        db.exec('COMMIT');
        open = false;
        pending = 0;
      }
    },
    finish() {
      if (open) db.exec('COMMIT');
      open = false;
      return count;
    },
  };
}

function readPageFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listPageFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
}

// Mirrors dataset/scripts/jsonl-store.js readJsonl(): a paged table dir wins over
// the root <table>.jsonl file, because the paged dirs are what every dataset script
// reads and writes.
function tableSourceFiles(table) {
  const dir = path.join(mainDir, table);
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    const pages = fs
      .readdirSync(dir)
      .filter((name) => /^\d{4}\.jsonl$/.test(name))
      .sort();
    if (pages.length) return pages.map((name) => path.join(dir, name));
  }
  const root = path.join(mainDir, `${table}.jsonl`);
  if (fs.existsSync(root)) return [root];
  return fail(`missing dataset source for ${table} (no ${table}/ paged dir and no ${table}.jsonl)`);
}

async function streamTable(table, onRow) {
  const files = tableSourceFiles(table);
  let count = 0;
  for (const file of files) {
    const reader = readline.createInterface({
      input: fs.createReadStream(file, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of reader) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      onRow(JSON.parse(trimmed));
      count += 1;
    }
  }
  return count;
}

const jsonOrNull = (value) => (value === undefined || value === null ? null : JSON.stringify(value));

// ------------------------------------------------------------- list views

// Rank-based sort keys: the export files order rows with ICU localeCompare, which
// SQLite's BINARY collation cannot reproduce. Every row therefore stores its RANK
// in each (sort, direction) ordering, taken from rankRows() — the same comparator
// generate-exports.js uses — so `ORDER BY k_<sort>_<direction> ASC` reproduces the
// published page files exactly, tie-breaks and "missing last" included.
function buildRankKeys(rows, label) {
  const rankMaps = new Map();
  for (const sort of SORT_KEYS) {
    for (const direction of SORT_DIRECTIONS) {
      rankMaps.set(`${sort}:${direction}`, rankRows(rows, sort, direction));
    }
  }

  return (row) => {
    const keys = {};
    for (const sort of SORT_KEYS) {
      for (const direction of SORT_DIRECTIONS) {
        const rank = rankMaps.get(`${sort}:${direction}`).get(row.id);
        if (!rank) fail(`${label} row ${row.id} got no rank for ${sort}/${direction}`);
        keys[sortKeyColumn(sort, direction)] = rank;
      }
    }
    return keys;
  };
}

// First rank of every page of every (sort, direction) ordering.
function pageKeyRows(viewKey, total, pageSize) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const keys = [];
  for (const sort of SORT_KEYS) {
    for (const direction of SORT_DIRECTIONS) {
      for (let page = 1; page <= pageCount; page += 1) {
        keys.push({ view: viewKey, sort, direction, page, key: keyForRank(pageStartRank(page, pageSize)) });
      }
    }
  }
  return keys;
}

function readViewRows(dir, label) {
  const files = listPageFiles(dir);
  if (!files.length) fail(`no ${label} page files under ${dir} — run pnpm dataset:export first`);

  const rows = [];
  const seen = new Set();
  for (const file of files) {
    const page = readPageFile(path.join(dir, file));
    for (const row of page.rows) {
      if (seen.has(row.id)) fail(`duplicate ${label} id across exported pages: ${row.id}`);
      seen.add(row.id);
      rows.push(row);
    }
  }
  log(`${label} view: ${rows.length.toLocaleString()} rows from ${files.length} page files`);
  return rows;
}

// Ties in the export comparators fall back to the order of the source array
// (Array#sort is stable), and that array is the JSONL insertion order: works from
// the paged `works/` dir, candidates from generated/candidates/books.jsonl. The
// view rows are therefore re-ordered the same way BEFORE ranks are assigned,
// otherwise rows with identical titles/years could come back in a different order
// than the published page files.
async function readTableOrder(table) {
  const order = new Map();
  const count = await streamTable(table, (row) => order.set(row.id, order.size));
  if (order.size !== count) fail(`${table}: duplicate ids in the source JSONL (${count} rows, ${order.size} unique)`);
  log(`${table}: canonical JSONL order indexed (${count.toLocaleString()} rows)`);
  return order;
}

async function readJsonlFileOrder(filePath, label) {
  if (!fs.existsSync(filePath)) fail(`missing ${filePath}`);
  const order = new Map();
  const reader = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of reader) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const row = JSON.parse(trimmed);
    order.set(row.id, order.size);
  }
  log(`${label}: canonical JSONL order indexed (${order.size.toLocaleString()} rows)`);
  return order;
}

function orderViewRows(rows, canonicalOrder, label) {
  const missing = rows.filter((row) => !canonicalOrder.has(row.id));
  if (missing.length) {
    fail(`${label}: ${missing.length} exported rows are not in the source JSONL (e.g. ${missing[0].id})`);
  }
  return rows.slice().sort((a, b) => canonicalOrder.get(a.id) - canonicalOrder.get(b.id));
}

async function ingestWorksView() {
  const canonicalOrder = await readTableOrder('works');
  const rows = orderViewRows(readViewRows(path.join(exportsDir, 'works', 'pages', 'title', 'asc'), 'works'), canonicalOrder, 'works');
  const keysForRow = buildRankKeys(rows, 'works');

  const inserter = makeInserter(
    `INSERT INTO dataset_works (${worksViewColumns.join(', ')}) VALUES (${worksViewColumns.map(() => '?').join(', ')})`,
  );
  for (const row of rows) {
    const keys = keysForRow(row);
    inserter.run([
      row.id,
      row.title_bn ?? null,
      row.title_en ?? null,
      row.first_published_year ?? null,
      row.language ?? null,
      row.genre ?? null,
      row.confidence ?? null,
      row.edition_count ?? 0,
      row.source_count ?? (row.source_refs || []).length,
      jsonOrNull(row.aliases),
      JSON.stringify(row.source_refs ?? []),
      JSON.stringify(row.edition_source_refs ?? []),
      JSON.stringify(row.authors ?? []),
      extrasFor(row, WORKS_DECLARED_KEYS),
      ...SORT_KEY_COLUMNS.map((column) => keys[column]),
    ]);
  }
  const total = inserter.finish();
  log(`works view: ${total.toLocaleString()} rows inserted`);
  return total;
}

async function ingestCandidatesView() {
  const canonicalOrder = await readJsonlFileOrder(path.join(mainDir, 'generated', 'candidates', 'books.jsonl'), 'candidates');
  const rows = orderViewRows(
    readViewRows(path.join(exportsDir, 'candidate-books', 'pages', 'title', 'asc'), 'candidates'),
    canonicalOrder,
    'candidates',
  );
  const keysForRow = buildRankKeys(rows, 'candidates');

  const inserter = makeInserter(
    `INSERT INTO dataset_candidates (${candidateViewColumns.join(', ')}) VALUES (${candidateViewColumns.map(() => '?').join(', ')})`,
  );
  for (const row of rows) {
    const keys = keysForRow(row);
    inserter.run([
      row.id,
      row.normalized_work_id ?? null,
      row.title_bn ?? null,
      row.title_en ?? null,
      row.first_published_year ?? null,
      row.language ?? null,
      row.confidence ?? null,
      row.edition_count ?? 0,
      row.verification_status ?? null,
      row.reason ?? null,
      JSON.stringify(row.source_refs ?? []),
      JSON.stringify(row.sources ?? []),
      JSON.stringify(row.authors ?? []),
      extrasFor(row, CANDIDATE_DECLARED_KEYS),
      ...SORT_KEY_COLUMNS.map((column) => keys[column]),
    ]);
  }
  const total = inserter.finish();
  log(`candidates view: ${total.toLocaleString()} rows inserted`);
  return total;
}

const worksViewTotal = await ingestWorksView();
const candidatesTotal = await ingestCandidatesView();

// ------------------------------------------------------------- raw tables

const worksInserter = makeInserter(
  'INSERT INTO works (id, title_bn, title_en, language, genre, first_published_year, confidence, aliases, source_refs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
);
const editionsInserter = makeInserter(
  'INSERT INTO editions (id, work_id, title_as_printed, publisher, publication_year, isbn, pages, format, confidence, source_refs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
);
const authorsInserter = makeInserter(
  'INSERT INTO authors (id, name_bn, name_en, birth_year, death_year, country_or_region, notes, confidence, aliases, source_refs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
);
const contributionsInserter = makeInserter(
  'INSERT INTO contributions (id, work_id, edition_id, author_id, role, confidence, aliases, source_refs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
);
const sourcesInserter = makeInserter(
  'INSERT INTO source_records (id, source, url, retrieved_at, raw_path, external_id, record_type, raw_title, raw_author, notes, aliases, source_refs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
);

log('ingesting works');
const worksRaw = await streamTable('works', (row) => {
  worksInserter.run([
    row.id,
    row.title_bn ?? null,
    row.title_en ?? null,
    row.language ?? null,
    row.genre ?? null,
    row.first_published_year ?? null,
    row.confidence ?? null,
    jsonOrNull(row.aliases),
    jsonOrNull(row.source_refs),
  ]);
});
worksInserter.finish();

log('ingesting editions');
const editionsCount = await streamTable('editions', (row) => {
  editionsInserter.run([
    row.id,
    row.work_id ?? null,
    row.title_as_printed ?? null,
    row.publisher ?? null,
    row.publication_year ?? null,
    row.isbn ?? null,
    row.pages ?? null,
    row.format ?? null,
    row.confidence ?? null,
    jsonOrNull(row.source_refs),
  ]);
});
editionsInserter.finish();

log('ingesting authors');
const authorsCount = await streamTable('authors', (row) => {
  authorsInserter.run([
    row.id,
    row.name_bn ?? null,
    row.name_en ?? null,
    row.birth_year ?? null,
    row.death_year ?? null,
    row.country_or_region ?? null,
    row.notes ?? null,
    row.confidence ?? null,
    jsonOrNull(row.aliases),
    jsonOrNull(row.source_refs),
  ]);
});
authorsInserter.finish();

log('ingesting contributions');
const contributionsCount = await streamTable('contributions', (row) => {
  contributionsInserter.run([
    row.id,
    row.work_id ?? null,
    row.edition_id ?? null,
    row.author_id ?? null,
    row.role ?? null,
    row.confidence ?? null,
    jsonOrNull(row.aliases),
    jsonOrNull(row.source_refs),
  ]);
});
contributionsInserter.finish();

log('ingesting source_records');
const sourcesCount = await streamTable('source_records', (row) => {
  sourcesInserter.run([
    row.id,
    row.source ?? null,
    row.url ?? null,
    row.retrieved_at ?? null,
    row.raw_path ?? null,
    row.external_id ?? null,
    row.record_type ?? null,
    row.raw_title ?? null,
    row.raw_author ?? null,
    row.notes ?? null,
    jsonOrNull(row.aliases),
    jsonOrNull(row.source_refs),
  ]);
});
sourcesInserter.finish();

log(
  `raw tables: works=${worksRaw.toLocaleString()} editions=${editionsCount.toLocaleString()} authors=${authorsCount.toLocaleString()} contributions=${contributionsCount.toLocaleString()} source_records=${sourcesCount.toLocaleString()}`,
);

// ------------------------------------------------------------- root export files

// The root export files are stored verbatim so /dataset/exports/<file> keeps
// returning exactly what the export pipeline produced, served from the DB instead
// of the 2.7 GB generated file grid. books-manifest.json is an alias of
// works-manifest.json and is resolved in the route.
const ROOT_EXPORT_FILES = [
  'works-manifest.json',
  'candidate-books-manifest.json',
  'references-manifest.json',
  'dataset-summary.json',
  'candidate-books.json',
];

log('storing root export files');
const exportFileInserter = makeInserter('INSERT INTO dataset_export_files (name, bytes, encoding, content) VALUES (?, ?, ?, ?)');
let exportFileBytes = 0;
for (const name of ROOT_EXPORT_FILES) {
  const filePath = path.join(exportsDir, name);
  if (!fs.existsSync(filePath)) fail(`missing root export file ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');
  exportFileInserter.run([name, Buffer.byteLength(content), 'utf8', Buffer.from(content, 'utf8')]);
  exportFileBytes += Buffer.byteLength(content);
}
log(`  stored ${ROOT_EXPORT_FILES.length} root files (${(exportFileBytes / 1048576).toFixed(2)} MB)`);

// The references grid is stored as the published page files themselves. Raw
// source_records rows carry ragged key sets (each row only has the fields it
// has), so regenerating them from normalized columns could not be byte-faithful.
// They are 416 MB of JSON in total, which gzips 8.4x, so the stored blob is gzip
// and the serving route decompresses it back to the exact file.
log('storing references export pages');
const referencePageFiles = listPageFiles(path.join(exportsDir, 'references', 'pages'));
if (!referencePageFiles.length) fail('no references page files — run pnpm dataset:export first');
let referenceBytes = 0;
let referenceStoredBytes = 0;
for (const fileName of referencePageFiles) {
  const filePath = path.join(exportsDir, 'references', 'pages', fileName);
  const content = fs.readFileSync(filePath, 'utf8');
  const gzipped = zlib.gzipSync(Buffer.from(content, 'utf8'), { level: 6 });
  exportFileInserter.run([`references/pages/${fileName}`, Buffer.byteLength(content), 'gzip', gzipped]);
  referenceBytes += Buffer.byteLength(content);
  referenceStoredBytes += gzipped.length;
}
exportFileInserter.finish();
log(
  `  stored ${referencePageFiles.length} references pages (${(referenceBytes / 1048576).toFixed(1)} MB -> ${(referenceStoredBytes / 1048576).toFixed(1)} MB gzipped)`,
);

// ------------------------------------------------------------- indexes

log('creating indexes');
for (const column of SORT_KEY_COLUMNS) {
  db.exec(`CREATE INDEX ix_dw_${column} ON dataset_works(${column});`);
  db.exec(`CREATE INDEX ix_dc_${column} ON dataset_candidates(${column});`);
}
db.exec('CREATE INDEX ix_editions_work ON editions(work_id);');
db.exec('CREATE INDEX ix_contributions_work ON contributions(work_id);');
db.exec('CREATE INDEX ix_contributions_author ON contributions(author_id);');

// ------------------------------------------------------------- page keys

log('building page keys');
const pageKeyInserter = db.prepare(
  'INSERT INTO dataset_page_keys (view, sort, direction, page, key) VALUES (?, ?, ?, ?, ?)',
);
for (const [viewKey, view] of Object.entries(DATASET_VIEWS)) {
  const total = viewKey === 'works' ? worksViewTotal : candidatesTotal;
  const keys = pageKeyRows(viewKey, total, view.pageSize);
  for (const entry of keys) pageKeyInserter.run(entry.view, entry.sort, entry.direction, entry.page, entry.key);
  log(`  ${viewKey}: ${keys.length} page keys (${Math.max(1, Math.ceil(total / view.pageSize))} pages x ${SORT_KEYS.length * SORT_DIRECTIONS.length} orderings)`);
}

// ------------------------------------------------------------- stats

const worksPageCount = Math.max(1, Math.ceil(worksViewTotal / WORKS_PAGE_SIZE));
const candidatesPageCount = Math.max(1, Math.ceil(candidatesTotal / CANDIDATES_PAGE_SIZE));
const referencesPageCount = Math.max(1, Math.ceil(sourcesCount / REFERENCES_PAGE_SIZE));

db.prepare(
  `INSERT INTO dataset_stats (
    id, updated_at,
    source_records, authors_raw, works_raw, editions, contributions,
    works_view_total, works_view_page_size, works_view_page_count,
    candidates_total, candidates_page_size, candidates_page_count,
    references_page_size, references_page_count
  ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  new Date().toISOString(),
  sourcesCount,
  authorsCount,
  worksRaw,
  editionsCount,
  contributionsCount,
  worksViewTotal,
  WORKS_PAGE_SIZE,
  worksPageCount,
  candidatesTotal,
  CANDIDATES_PAGE_SIZE,
  candidatesPageCount,
  REFERENCES_PAGE_SIZE,
  referencesPageCount,
);

// ------------------------------------------------------------- verify

log('verifying raw counts against dataset-summary.json');
const expectedSummaryPath = path.join(exportsDir, 'dataset-summary.json');
if (fs.existsSync(expectedSummaryPath)) {
  const expected = JSON.parse(fs.readFileSync(expectedSummaryPath, 'utf8')).counts;
  for (const [label, actual, want] of [
    ['source_records', sourcesCount, expected.source_records],
    ['authors', authorsCount, expected.authors],
    ['works', worksRaw, expected.works],
    ['editions', editionsCount, expected.editions],
    ['contributions', contributionsCount, expected.contributions],
  ]) {
    if (actual !== want) fail(`raw ${label} count mismatch: built ${actual}, dataset-summary says ${want}`);
    log(`  ok ${label} = ${actual.toLocaleString()}`);
  }
}

log('verifying view totals against the published manifests');
for (const [label, file, actual] of [
  ['works', 'works-manifest.json', worksViewTotal],
  ['candidates', 'candidate-books-manifest.json', candidatesTotal],
]) {
  const manifestPath = path.join(exportsDir, file);
  if (!fs.existsSync(manifestPath)) fail(`missing manifest ${manifestPath}`);
  const manifestTotal = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).total;
  if (manifestTotal !== actual) fail(`${label} view total mismatch: built ${actual}, manifest says ${manifestTotal}`);
  log(`  ok ${label} view total = ${actual.toLocaleString()}`);
}

log('verifying database pages match the published export files');
const verifyTargets = [
  ['works', 'title', 'asc', 1],
  ['works', 'title', 'desc', 500],
  ['works', 'author', 'asc', 300],
  ['works', 'year', 'desc', 834],
  ['works', 'editions', 'desc', 100],
  ['candidates', 'title', 'asc', 7],
  ['candidates', 'author', 'desc', 12],
];

const parseJsonValue = (value) => (value === null || value === undefined ? null : JSON.parse(value));

// Same field order as the export files, with undeclared extras merged back in.
function exportRowFromDb(viewKey, row) {
  const extras = row.extras ? JSON.parse(row.extras) : {};
  if (viewKey === 'works') {
    return {
      ...extras,
      id: row.id,
      title_bn: row.title_bn,
      title_en: row.title_en,
      aliases: parseJsonValue(row.aliases),
      language: row.language,
      genre: row.genre,
      first_published_year: row.first_published_year,
      source_refs: parseJsonValue(row.source_refs),
      confidence: row.confidence,
      source_count: row.source_count,
      edition_source_refs: parseJsonValue(row.edition_source_refs),
      authors: parseJsonValue(row.authors),
      edition_count: row.edition_count,
    };
  }

  return {
    ...extras,
    id: row.id,
    normalized_work_id: row.normalized_work_id,
    title_bn: row.title_bn,
    title_en: row.title_en,
    authors: parseJsonValue(row.authors),
    language: row.language,
    first_published_year: row.first_published_year,
    edition_count: row.edition_count,
    source_refs: parseJsonValue(row.source_refs),
    confidence: row.confidence,
    verification_status: row.verification_status,
    reason: row.reason,
    sources: parseJsonValue(row.sources),
  };
}

function compareExportRows(viewKey, dbRow, fileRow, label) {
  const dbKeys = Object.keys(dbRow).sort().join(',');
  const fileKeys = Object.keys(fileRow).sort().join(',');
  if (dbKeys !== fileKeys) fail(`${label}: key mismatch\n  db:   ${dbKeys}\n  file: ${fileKeys}`);
  for (const key of Object.keys(fileRow)) {
    const dbValue = JSON.stringify(dbRow[key] ?? null);
    const fileValue = JSON.stringify(fileRow[key] ?? null);
    if (dbValue !== fileValue) fail(`${label}: field ${key} differs\n  db:   ${String(dbValue).slice(0, 300)}\n  file: ${String(fileValue).slice(0, 300)}`);
  }
}

function collectRowReferenceIds(rows) {
  const refs = new Set();
  for (const row of rows) {
    for (const ref of row.source_refs ?? []) refs.add(ref);
    for (const ref of row.edition_source_refs ?? []) refs.add(ref);
    for (const author of row.authors ?? []) {
      for (const ref of author.source_refs ?? []) refs.add(ref);
    }
  }
  return Array.from(refs);
}

for (const [viewKey, sort, direction, page] of verifyTargets) {
  const view = DATASET_VIEWS[viewKey];
  const column = sortKeyColumn(sort, direction);
  const filePath = path.join(exportsDir, view.exportRoot, 'pages', sort, direction, `${String(page).padStart(4, '0')}.json`);
  const filePage = readPageFile(filePath);
  const dbRows = db
    .prepare(`SELECT * FROM ${view.table} WHERE ${column} >= ? ORDER BY ${column} ASC LIMIT ?`)
    .all(keyForRank(pageStartRank(page, view.pageSize)), view.pageSize);

  if (dbRows.length !== filePage.rows.length) {
    fail(`${viewKey}/${sort}/${direction} page ${page}: db has ${dbRows.length} rows, export file has ${filePage.rows.length}`);
  }

  for (let index = 0; index < dbRows.length; index += 1) {
    if (dbRows[index].id !== filePage.rows[index].id) {
      fail(
        `${viewKey}/${sort}/${direction} page ${page}: row ${index} is ${dbRows[index].id} in the db but ${filePage.rows[index].id} in the export file`,
      );
    }
    compareExportRows(viewKey, exportRowFromDb(viewKey, dbRows[index]), filePage.rows[index], `${viewKey}/${sort}/${direction} page ${page} row ${index}`);
  }

  if (filePage.references) {
    const referenceIds = collectRowReferenceIds(filePage.rows);
    const dbReferenceIds = collectRowReferenceIds(dbRows.map((row) => exportRowFromDb(viewKey, row)));
    if (dbReferenceIds.join(',') !== referenceIds.join(',')) {
      fail(`${viewKey}/${sort}/${direction} page ${page}: reference id order differs from the export file`);
    }
    const placeholders = referenceIds.map(() => '?').join(', ');
    const found = db.prepare(`SELECT id FROM source_records WHERE id IN (${placeholders})`).all(...referenceIds);
    if (found.length !== referenceIds.length) {
      fail(`${viewKey}/${sort}/${direction} page ${page}: ${referenceIds.length - found.length} references missing from source_records`);
    }
  }

  log(`  ok ${viewKey}/${sort}/${direction} page ${page} -> ${dbRows.length} rows, order/content/references match the export file`);
}

log('verifying stored export files are byte-identical to disk');
for (const name of [...ROOT_EXPORT_FILES, 'references/pages/0001.json', 'references/pages/0026.json', `references/pages/${String(referencesPageCount).padStart(4, '0')}.json`]) {
  const stored = db.prepare('SELECT content, bytes, encoding FROM dataset_export_files WHERE name = ?').get(name);
  if (!stored) fail(`stored export file missing: ${name}`);
  const decoded = stored.encoding === 'gzip' ? zlib.gunzipSync(stored.content) : Buffer.from(stored.content);
  const onDisk = fs.readFileSync(path.join(exportsDir, name));
  if (!decoded.equals(onDisk)) fail(`stored export file ${name} differs from disk`);
  if (Number(stored.bytes) !== onDisk.length) fail(`stored export file ${name} byte count is wrong`);
  log(`  ok ${name} (${(onDisk.length / 1024).toFixed(1)} KB, ${stored.encoding})`);
}

log('checking keyset query plan');
const plan = db.prepare('EXPLAIN QUERY PLAN SELECT id FROM dataset_works WHERE k_title_asc >= ? ORDER BY k_title_asc LIMIT 250').all('x');
const planText = plan.map((row) => row.detail).join(' | ');
if (!/USING INDEX/i.test(planText)) fail(`keyset query does not use an index: ${planText}`);
log(`  ok ${planText}`);

const integrity = db.prepare('PRAGMA integrity_check').get();
if (integrity.integrity_check !== 'ok') fail(`integrity_check failed: ${integrity.integrity_check}`);
log('  ok integrity_check');

db.exec('PRAGMA optimize;');
db.exec('PRAGMA journal_mode = WAL;');
db.close();
// SQLite runs a final checkpoint on close; the shipped DB file must be self-contained.
for (const suffix of ['-wal', '-shm']) {
  const sidecar = `${dbPath}${suffix}`;
  if (!fs.existsSync(sidecar)) continue;
  if (fs.statSync(sidecar).size === 0) {
    fs.rmSync(sidecar);
  } else {
    fail(`unexpected non-empty sidecar ${sidecar}; the exported DB file would not be self-contained`);
  }
}

const sizeBytes = fs.statSync(dbPath).size;
const manifest = {
  format_version: 1,
  built_at: new Date().toISOString(),
  database: path.basename(dbPath),
  size_bytes: sizeBytes,
  counts: {
    source_records: sourcesCount,
    authors: authorsCount,
    works: worksRaw,
    editions: editionsCount,
    contributions: contributionsCount,
    works_view: worksViewTotal,
    candidates: candidatesTotal,
  },
  page_sizes: {
    works: WORKS_PAGE_SIZE,
    candidates: CANDIDATES_PAGE_SIZE,
    references: REFERENCES_PAGE_SIZE,
  },
  page_counts: {
    works: worksPageCount,
    candidates: candidatesPageCount,
    references: referencesPageCount,
  },
  export_files: [...ROOT_EXPORT_FILES, `references/pages/*.json (${referencePageFiles.length} pages)`],
  sort_key_columns: SORT_KEY_COLUMNS,
};
fs.writeFileSync(path.join(outDir, 'db-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

log(`done: ${dbPath} (${(sizeBytes / 1048576).toFixed(1)} MB)`);
log(`works view ${worksViewTotal.toLocaleString()} rows / ${worksPageCount} pages, candidates ${candidatesTotal.toLocaleString()} rows / ${candidatesPageCount} pages`);
