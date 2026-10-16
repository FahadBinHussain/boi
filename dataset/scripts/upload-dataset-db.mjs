#!/usr/bin/env node
// Uploads the locally built SQLite database to Turso (and can verify the live DB).
//
//   node dataset/scripts/upload-dataset-db.mjs            upload + verify
//   node dataset/scripts/upload-dataset-db.mjs --verify   verify only
//
// Env (never committed — see the vault item for this repo):
//   TURSO_DATABASE_URL   https://<database>-<org>.<region>.turso.io
//   TURSO_ADMIN_TOKEN    database token with full access (upload only)
//   TURSO_AUTH_TOKEN     database token with read-only access (verify, app)
//
// The upload endpoint replaces the whole database file and does NOT consume the
// monthly rows-written quota, which is why the deploy path is:
//   build locally -> upload file -> app reads over HTTP with a read-only token.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sortKeyColumn } from './dataset-db-schema.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const dbPath = path.join(repoRoot, 'dataset', 'main', 'generated', 'db', 'boi-dataset.db');
const manifestPath = path.join(repoRoot, 'dataset', 'main', 'generated', 'db', 'db-manifest.json');

const verifyOnly = process.argv.includes('--verify');

const databaseUrl = process.env.TURSO_DATABASE_URL;
const adminToken = process.env.TURSO_ADMIN_TOKEN;
const readToken = process.env.TURSO_AUTH_TOKEN;

function fail(message) {
  console.error(`\nFATAL: ${message}\n`);
  process.exit(1);
}

if (!databaseUrl) fail('TURSO_DATABASE_URL is not set');
if (!verifyOnly && !adminToken) fail('TURSO_ADMIN_TOKEN is not set (needed to upload)');
if (!readToken) fail('TURSO_AUTH_TOKEN is not set (needed to verify)');

const host = databaseUrl.replace(/^libsql:\/\//, 'https://').replace(/^https:\/\//, '').replace(/\/$/, '');
const base = `https://${host}`;

function decodeCell(cell) {
  if (cell === null || cell === undefined) return null;
  if (cell.type === 'null') return null;
  if (cell.type === 'integer') return Number(cell.value);
  if (cell.type === 'float') return Number(cell.value);
  if (cell.type === 'blob') {
    // Hrana value encoding: text/integer use `value`, blobs use `base64`.
    if (typeof cell.base64 !== 'string') fail(`blob cell without a base64 field: ${JSON.stringify(cell).slice(0, 120)}`);
    return Buffer.from(cell.base64, 'base64');
  }
  return cell.value;
}

async function queryWithMeta(sql, args = [], token = readToken) {
  const body = {
    requests: [
      { type: 'execute', stmt: { sql, args: args.map((value) => ({ type: 'text', value: String(value) })) } },
      { type: 'close' },
    ],
  };
  const response = await fetch(`${base}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) fail(`pipeline query failed (HTTP ${response.status}): ${text.slice(0, 500)}`);
  const payload = JSON.parse(text);
  const first = payload.results?.[0];
  if (!first) fail(`empty pipeline response: ${text.slice(0, 500)}`);
  if (first.type === 'error') fail(`sql error: ${first.error?.message ?? JSON.stringify(first).slice(0, 300)}`);
  if (first.type !== 'ok' || first.response?.type !== 'execute') fail(`unexpected pipeline response: ${text.slice(0, 500)}`);
  if (first.response.type === 'error') fail(`sql error: ${first.response.error?.message ?? 'unknown'}`);
  const result = first.response.result;
  const columns = (result.cols ?? []).map((column) => column.name);
  const rows = (result.rows ?? []).map((row) => {
    const record = {};
    row.forEach((cell, index) => {
      record[columns[index] ?? `column_${index}`] = decodeCell(cell);
    });
    return record;
  });
  return {
    rows,
    rowsRead: Number(result.rows_read ?? 0),
    durationMs: Number(result.query_duration_ms ?? 0),
  };
}

async function query(sql, args = [], token = readToken) {
  const { rows } = await queryWithMeta(sql, args, token);
  return rows;
}

if (!verifyOnly) {
  if (!fs.existsSync(dbPath)) fail(`missing ${dbPath} — run "node dataset/scripts/build-dataset-db.mjs" first`);
  const size = fs.statSync(dbPath).size;
  console.log(`uploading ${path.basename(dbPath)} (${(size / 1048576).toFixed(1)} MB) to ${host}`);

  // The upload MUST be one shot: /v1/upload only seeds a database that has no file
  // yet, and an aborted attempt leaves it locked with "Database upload already in
  // progress" until it is deleted and recreated.
  //
  // curl.exe is the transport that works. Node's fetch/undici streaming body dies
  // with ECONNRESET ("write ECONNRESET") part-way through multi-hundred-MB uploads.
  // --http1.1 disables HTTP/2, -H "Expect:" removes the 100-continue round trip, and
  // Content-Length is set explicitly with --data-binary.
  const startedAt = Date.now();
  const result = spawnSync(
    'curl.exe',
    [
      '--http1.1',
      '-sS',
      '-X',
      'POST',
      `${base}/v1/upload`,
      '-H',
      `Authorization: Bearer ${adminToken}`,
      '-H',
      `Content-Length: ${size}`,
      '-H',
      'Content-Type: application/octet-stream',
      '-H',
      'Expect:',
      '--data-binary',
      `@${dbPath}`,
    ],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (result.error) fail(`curl.exe could not be started: ${result.error.message}`);
  if (result.status !== 0) fail(`curl.exe exited with ${result.status}:\n${(result.stderr || '').slice(0, 800)}`);
  const responseText = String(result.stdout || '').trim();
  console.log(`upload accepted in ${elapsed}s: ${responseText.slice(0, 300) || '(empty response body)'}`);
  if (/"?error"?\s*:/i.test(responseText)) fail(`upload endpoint returned an error: ${responseText.slice(0, 800)}`);
}

console.log('waiting for the database to answer queries...');
let stats = null;
for (let attempt = 1; attempt <= 30; attempt += 1) {
  try {
    const { rows } = await queryWithMeta('SELECT * FROM dataset_stats WHERE id = 1');
    if (rows.length) {
      stats = rows[0];
      break;
    }
  } catch (error) {
    if (attempt === 30) fail(`database did not become queryable: ${error.message}`);
  }
  await delay(2000);
}
if (!stats) fail('dataset_stats row missing after upload');

const localManifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
if (localManifest) {
  for (const [label, actual, want] of [
    ['source_records', stats.source_records, localManifest.counts.source_records],
    ['authors', stats.authors_raw, localManifest.counts.authors],
    ['works', stats.works_raw, localManifest.counts.works],
    ['editions', stats.editions, localManifest.counts.editions],
    ['contributions', stats.contributions, localManifest.counts.contributions],
    ['works view', stats.works_view_total, localManifest.counts.works_view],
    ['candidates', stats.candidates_total, localManifest.counts.candidates],
  ]) {
    if (Number(actual) !== Number(want)) fail(`live ${label} = ${actual}, local build = ${want}`);
  }
  console.log('live counts match the local db-manifest.json');
}

console.log(
  `live dataset: works view ${Number(stats.works_view_total).toLocaleString()} / ${stats.works_view_page_count} pages, ` +
    `candidates ${Number(stats.candidates_total).toLocaleString()} / ${stats.candidates_page_count} pages, ` +
    `source_records ${Number(stats.source_records).toLocaleString()}`,
);

// Pages are served by key, so verify the key path end to end the way the app uses it.
const samplePages = [
  ['works', 'title', 'asc', 1],
  ['works', 'title', 'desc', 500],
  ['works', 'author', 'asc', 300],
  ['works', 'year', 'desc', 834],
  ['works', 'editions', 'desc', 100],
  ['candidates', 'title', 'asc', 7],
];
let pageViewReads = 0;
for (const [view, sort, direction, page] of samplePages) {
  const table = view === 'candidates' ? 'dataset_candidates' : 'dataset_works';
  const column = sortKeyColumn(sort, direction);
  const keyResult = await queryWithMeta(
    'SELECT key FROM dataset_page_keys WHERE view = ? AND sort = ? AND direction = ? AND page = ?',
    [view, sort, direction, page],
  );
  if (!keyResult.rows.length) fail(`missing page key ${view}/${sort}/${direction}/${page}`);
  const rowsResult = await queryWithMeta(
    `SELECT id, ${column} AS sort_key FROM ${table} WHERE ${column} >= ? ORDER BY ${column} ASC LIMIT 250`,
    [keyResult.rows[0].key],
  );
  const rows = rowsResult.rows;
  const ordered = rows.every((row, index) => index === 0 || row.sort_key >= rows[index - 1].sort_key);
  if (!ordered) fail(`${view}/${sort}/${direction} page ${page} came back out of order`);
  pageViewReads += keyResult.rowsRead + rowsResult.rowsRead;
  console.log(
    `  ok ${view}/${sort}/${direction} page ${page} -> ${rows.length} rows ` +
      `(rows_read: page-key ${keyResult.rowsRead}, rows ${rowsResult.rowsRead})`,
  );
}

// The page renderer resolves references by id, so check that path too.
const firstPage = await query(
  'SELECT id, source_refs, edition_source_refs, authors FROM dataset_works WHERE k_title_asc >= ? ORDER BY k_title_asc LIMIT 5',
  [''],
);
const refIds = new Set();
for (const row of firstPage) {
  for (const ref of JSON.parse(row.source_refs || '[]')) refIds.add(ref);
  for (const ref of JSON.parse(row.edition_source_refs || '[]')) refIds.add(ref);
  for (const author of JSON.parse(row.authors || '[]')) {
    for (const ref of author.source_refs || []) refIds.add(ref);
  }
}
if (refIds.size) {
  const placeholders = Array.from(refIds).map(() => '?').join(', ');
  const refsResult = await queryWithMeta(`SELECT id FROM source_records WHERE id IN (${placeholders})`, Array.from(refIds));
  if (refsResult.rows.length !== refIds.size) fail(`reference lookup returned ${refsResult.rows.length} of ${refIds.size} refs`);
  pageViewReads += refsResult.rowsRead;
  console.log(`  ok reference lookup by id (${refsResult.rows.length} rows, rows_read ${refsResult.rowsRead})`);
}

console.log(`\none /dataset page view costs ~${pageViewReads.toLocaleString()} rows read; the free plan allows 500,000,000 per month.`);

// Root export files and the references grid are stored verbatim in the DB.
console.log('\nchecking stored export files');
const statsRow = await query('SELECT references_page_count FROM dataset_stats WHERE id = 1');
if (!statsRow.length) fail('dataset_stats row missing');
const referencesPageCount = Number(statsRow[0].references_page_count);
if (!Number.isFinite(referencesPageCount) || referencesPageCount < 1) {
  fail(`dataset_stats.references_page_count is not usable: ${statsRow[0].references_page_count}`);
}
const storedFiles = [
  'works-manifest.json',
  'candidate-books-manifest.json',
  'references-manifest.json',
  'dataset-summary.json',
  'candidate-books.json',
  'references/pages/0001.json',
  'references/pages/0026.json',
  `references/pages/${String(referencesPageCount).padStart(4, '0')}.json`,
];
for (const name of storedFiles) {
  const result = await queryWithMeta('SELECT bytes, encoding, content FROM dataset_export_files WHERE name = ?', [name]);
  if (!result.rows.length) fail(`missing stored export file ${name}`);
  const row = result.rows[0];
  const stored = row.content;
  if (!Buffer.isBuffer(stored)) fail(`stored export file ${name} did not come back as a blob (got ${typeof stored})`);
  const decoded = String(row.encoding) === 'gzip' ? gunzipSync(stored) : stored;
  if (decoded.length !== Number(row.bytes)) {
    fail(`stored export file ${name}: decoded ${decoded.length} bytes, expected ${row.bytes}`);
  }
  JSON.parse(decoded.toString('utf8'));
  console.log(`  ok ${name} (${(Number(row.bytes) / 1024).toFixed(1)} KB, ${row.encoding}, rows_read ${result.rowsRead})`);
}

console.log('\nTurso database verified.');
