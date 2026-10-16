import { gunzipSync } from 'node:zlib';
import { createClient, type Client, type InValue } from '@libsql/client/web';
import { sortKeyColumn } from '../../dataset/scripts/dataset-db-schema.mjs';

// Live dataset reads for /dataset and /dataset/exports/*.
//
// The dataset (208k public works, 2.8k candidates, 508k source records, plus the
// full normalized tables) lives in a Turso database built by
// dataset/scripts/build-dataset-db.mjs and uploaded by
// dataset/scripts/upload-dataset-db.mjs.
//
// Free-tier guardrails, in order of importance:
//   1. the app gets a READ-ONLY database token, so a bug can never write
//   2. list pages are keyset reads: dataset_page_keys holds the first key of every
//      page, so page N costs one tiny lookup + one index range scan. No OFFSET and
//      no COUNT(*) anywhere at request time, which is what keeps deep pages free.
//   3. counts come from the precomputed dataset_stats row (cached briefly in the
//      server process) instead of aggregate queries.
//   4. references are fetched in batched id lookups, not joins over the whole table.
//
// If the database or its env vars are missing the page renders a loud error panel:
// there is no fallback data path by design.

export type DatasetSortKey = 'title' | 'author' | 'year' | 'editions';
export type DatasetSortDirection = 'asc' | 'desc';
export type DatasetViewKey = 'works' | 'candidates';

export const datasetSortKeys: DatasetSortKey[] = ['title', 'author', 'year', 'editions'];
export const datasetSortDirections: DatasetSortDirection[] = ['asc', 'desc'];
export const datasetViewKeys: DatasetViewKey[] = ['works', 'candidates'];

export type DatasetWorkAuthor = {
  id: string;
  name_bn: string | null;
  name_en: string | null;
  role: string;
  source_refs?: string[];
};

export type DatasetWork = {
  id: string;
  title_bn: string | null;
  title_en: string | null;
  aliases?: string[];
  language?: string | null;
  genre?: string | null;
  first_published_year: number | null;
  source_refs: string[];
  source_count?: number;
  edition_source_refs?: string[];
  confidence?: number | null;
  edition_count: number;
  authors: DatasetWorkAuthor[];
  extras?: Record<string, unknown> | null;
};

export type DatasetCandidateSource = {
  label: string;
  url: string;
  retrieved_at: string;
  notes: string;
};

export type DatasetCandidateBook = {
  id: string;
  normalized_work_id?: string | null;
  title_bn: string | null;
  title_en: string | null;
  authors: DatasetWorkAuthor[];
  language?: string | null;
  first_published_year: number | null;
  edition_count: number;
  source_refs: string[];
  confidence?: number | null;
  verification_status: string;
  reason: string | null;
  sources: DatasetCandidateSource[];
  extras?: Record<string, unknown> | null;
};

export type DatasetBookRow = DatasetWork | DatasetCandidateBook;

export type DatasetReference = {
  id: string;
  source: string;
  url: string | null;
  record_type: string;
  raw_title: string | null;
};

export type DatasetStats = {
  updated_at: string;
  source_records: number;
  authors: number;
  works: number;
  editions: number;
  contributions: number;
  works_view_total: number;
  works_view_page_size: number;
  works_view_page_count: number;
  candidates_total: number;
  candidates_page_size: number;
  candidates_page_count: number;
  references_page_size: number;
  references_page_count: number;
};

export type DatasetPage = {
  view: DatasetViewKey;
  sort: DatasetSortKey;
  direction: DatasetSortDirection;
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  rows: DatasetBookRow[];
  references: DatasetReference[];
};

export class DatasetDatabaseError extends Error {
  readonly detail: string;

  constructor(message: string, detail: string) {
    super(message);
    this.name = 'DatasetDatabaseError';
    this.detail = detail;
  }
}

const VIEW_COLUMNS: Record<DatasetViewKey, string> = {
  works: [
    'id',
    'title_bn',
    'title_en',
    'aliases',
    'language',
    'genre',
    'first_published_year',
    'source_refs',
    'confidence',
    'source_count',
    'edition_source_refs',
    'authors',
    'edition_count',
    'extras',
  ].join(', '),
  candidates: [
    'id',
    'normalized_work_id',
    'title_bn',
    'title_en',
    'authors',
    'language',
    'first_published_year',
    'edition_count',
    'source_refs',
    'confidence',
    'verification_status',
    'reason',
    'sources',
    'extras',
  ].join(', '),
};

const VIEW_TABLES: Record<DatasetViewKey, string> = {
  works: 'dataset_works',
  candidates: 'dataset_candidates',
};

const REFERENCE_COLUMNS = 'id, source, url, record_type, raw_title';
const REFERENCE_LOOKUP_CHUNK = 400;
const STATS_CACHE_MS = 5 * 60 * 1000;

let cachedClient: Client | null = null;
let statsCache: { value: DatasetStats; expiresAt: number } | null = null;

function getClient(): Client {
  if (cachedClient) return cachedClient;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new DatasetDatabaseError(
      'Dataset database is not configured',
      [
        'TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are missing from the server environment.',
        'Locally: restore them into .env.local (vault item for this repo) and restart `pnpm dev`.',
        'On Vercel: add both to the project env for Production + Preview, then redeploy.',
      ].join('\n'),
    );
  }

  cachedClient = createClient({ url, authToken });
  return cachedClient;
}

async function execute(sql: string, args: InValue[] = []): Promise<Record<string, unknown>[]> {
  try {
    const result = await getClient().execute({ sql, args });
    return result.rows as unknown as Record<string, unknown>[];
  } catch (error) {
    if (error instanceof DatasetDatabaseError) throw error;
    throw new DatasetDatabaseError(
      'Dataset database query failed',
      [`sql: ${sql}`, `args: ${JSON.stringify(args)}`, '', error instanceof Error ? `${error.name}: ${error.message}` : String(error)].join('\n'),
    );
  }
}

function decodeJsonArray(value: unknown, context: string): unknown[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      throw new Error(`expected an array, got ${typeof parsed}`);
    } catch (error) {
      throw new DatasetDatabaseError(
        'Dataset row contains malformed JSON',
        [`row/field: ${context}`, `value: ${String(value).slice(0, 200)}`, error instanceof Error ? error.message : String(error)].join('\n'),
      );
    }
  }
  throw new DatasetDatabaseError('Dataset row contains an unexpected value', `row/field: ${context}, value type: ${typeof value}`);
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeJsonObject(value: unknown, context: string): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new DatasetDatabaseError('Dataset row contains an unexpected value', `row/field: ${context}, value type: ${typeof value}`);
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    throw new Error(`expected an object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`);
  } catch (error) {
    throw new DatasetDatabaseError(
      'Dataset row contains malformed JSON',
      [`row/field: ${context}`, `value: ${value.slice(0, 200)}`, error instanceof Error ? error.message : String(error)].join('\n'),
    );
  }
}

function toWorkRow(row: Record<string, unknown>): DatasetWork {
  return {
    id: String(row.id),
    title_bn: (row.title_bn as string | null) ?? null,
    title_en: (row.title_en as string | null) ?? null,
    aliases: decodeJsonArray(row.aliases, `${row.id}.aliases`) as string[],
    language: (row.language as string | null) ?? null,
    genre: (row.genre as string | null) ?? null,
    first_published_year: numberOrNull(row.first_published_year),
    source_refs: decodeJsonArray(row.source_refs, `${row.id}.source_refs`) as string[],
    source_count: numberOrNull(row.source_count) ?? undefined,
    edition_source_refs: decodeJsonArray(row.edition_source_refs, `${row.id}.edition_source_refs`) as string[],
    confidence: numberOrNull(row.confidence),
    edition_count: numberOrNull(row.edition_count) ?? 0,
    authors: decodeJsonArray(row.authors, `${row.id}.authors`) as DatasetWorkAuthor[],
    extras: decodeJsonObject(row.extras, `${row.id}.extras`),
  };
}

function toCandidateRow(row: Record<string, unknown>): DatasetCandidateBook {
  return {
    id: String(row.id),
    normalized_work_id: (row.normalized_work_id as string | null) ?? null,
    title_bn: (row.title_bn as string | null) ?? null,
    title_en: (row.title_en as string | null) ?? null,
    authors: decodeJsonArray(row.authors, `${row.id}.authors`) as DatasetWorkAuthor[],
    language: (row.language as string | null) ?? null,
    first_published_year: numberOrNull(row.first_published_year),
    edition_count: numberOrNull(row.edition_count) ?? 0,
    source_refs: decodeJsonArray(row.source_refs, `${row.id}.source_refs`) as string[],
    confidence: numberOrNull(row.confidence),
    verification_status: String(row.verification_status ?? 'pending'),
    reason: (row.reason as string | null) ?? null,
    sources: decodeJsonArray(row.sources, `${row.id}.sources`) as DatasetCandidateSource[],
    extras: decodeJsonObject(row.extras, `${row.id}.extras`),
  };
}

// The export page files carry rare undeclared fields (2542 works rows carry
// `author_id`); they are stored per row and merged back in on export.
function buildExportRow(row: DatasetBookRow): Record<string, unknown> {
  const extras = row.extras ?? {};

  if (isCandidateRow(row)) {
    return {
      ...extras,
      id: row.id,
      normalized_work_id: row.normalized_work_id,
      title_bn: row.title_bn,
      title_en: row.title_en,
      authors: row.authors,
      language: row.language,
      first_published_year: row.first_published_year,
      edition_count: row.edition_count,
      source_refs: row.source_refs,
      confidence: row.confidence,
      verification_status: row.verification_status,
      reason: row.reason,
      sources: row.sources,
    };
  }

  return {
    ...extras,
    id: row.id,
    title_bn: row.title_bn,
    title_en: row.title_en,
    aliases: row.aliases,
    language: row.language,
    genre: row.genre,
    first_published_year: row.first_published_year,
    source_refs: row.source_refs,
    confidence: row.confidence,
    source_count: row.source_count,
    edition_source_refs: row.edition_source_refs,
    authors: row.authors,
    edition_count: row.edition_count,
  };
}

export function isCandidateRow(row: DatasetBookRow): row is DatasetCandidateBook {
  return 'verification_status' in row;
}

export async function getDatasetStats(): Promise<DatasetStats> {
  const now = Date.now();
  if (statsCache && statsCache.expiresAt > now) return statsCache.value;

  const rows = await execute('SELECT * FROM dataset_stats WHERE id = 1');
  if (!rows.length) {
    throw new DatasetDatabaseError(
      'Dataset database is empty',
      ['dataset_stats has no row, so the database was uploaded without the builder output.', 'Rebuild with dataset:db:build and upload with dataset:db:upload.'].join('\n'),
    );
  }

  const row = rows[0];
  const stats: DatasetStats = {
    updated_at: String(row.updated_at ?? ''),
    source_records: numberOrNull(row.source_records) ?? 0,
    authors: numberOrNull(row.authors_raw) ?? 0,
    works: numberOrNull(row.works_raw) ?? 0,
    editions: numberOrNull(row.editions) ?? 0,
    contributions: numberOrNull(row.contributions) ?? 0,
    works_view_total: numberOrNull(row.works_view_total) ?? 0,
    works_view_page_size: numberOrNull(row.works_view_page_size) ?? 250,
    works_view_page_count: numberOrNull(row.works_view_page_count) ?? 1,
    candidates_total: numberOrNull(row.candidates_total) ?? 0,
    candidates_page_size: numberOrNull(row.candidates_page_size) ?? 250,
    candidates_page_count: numberOrNull(row.candidates_page_count) ?? 1,
    references_page_size: numberOrNull(row.references_page_size) ?? 10000,
    references_page_count: numberOrNull(row.references_page_count) ?? 1,
  };

  statsCache = { value: stats, expiresAt: now + STATS_CACHE_MS };
  return stats;
}

export async function getDatasetReferences(refIds: string[]): Promise<DatasetReference[]> {
  const unique = Array.from(new Set(refIds)).filter(Boolean);
  if (!unique.length) return [];

  const byId = new Map<string, DatasetReference>();
  for (let index = 0; index < unique.length; index += REFERENCE_LOOKUP_CHUNK) {
    const chunk = unique.slice(index, index + REFERENCE_LOOKUP_CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const rows = await execute(`SELECT ${REFERENCE_COLUMNS} FROM source_records WHERE id IN (${placeholders})`, chunk);
    for (const row of rows) {
      byId.set(String(row.id), {
        id: String(row.id),
        source: String(row.source ?? ''),
        url: (row.url as string | null) ?? null,
        record_type: String(row.record_type ?? ''),
        raw_title: (row.raw_title as string | null) ?? null,
      });
    }
  }

  // The export files list references in first-appearance order, so the fetched
  // rows are put back into the requested order; ids that are not in
  // source_records are dropped, exactly like the export's filter(Boolean).
  return unique
    .map((id) => byId.get(id))
    .filter((reference): reference is DatasetReference => reference !== undefined);
}

function collectRowReferenceIds(row: DatasetBookRow): string[] {
  if (isCandidateRow(row)) return row.source_refs;

  const refs = new Set<string>();
  for (const ref of row.source_refs) refs.add(ref);
  for (const ref of row.edition_source_refs ?? []) refs.add(ref);
  for (const author of row.authors) {
    for (const ref of author.source_refs ?? []) refs.add(ref);
  }
  return Array.from(refs);
}

export function collectPageReferenceIds(rows: DatasetBookRow[]): string[] {
  const refs = new Set<string>();
  for (const row of rows) {
    for (const ref of collectRowReferenceIds(row)) refs.add(ref);
  }
  return Array.from(refs);
}

function pageKeyedArgs(view: DatasetViewKey, sort: DatasetSortKey, direction: DatasetSortDirection, page: number): [string, string, string, number] {
  return [view, sort, direction, page];
}

export async function getDatasetRowsPage({
  view,
  sort,
  direction,
  page,
  pageSize,
}: {
  view: DatasetViewKey;
  sort: DatasetSortKey;
  direction: DatasetSortDirection;
  page: number;
  pageSize: number;
}): Promise<DatasetBookRow[]> {
  const table = VIEW_TABLES[view];
  const columns = VIEW_COLUMNS[view];
  const column = sortKeyColumn(sort, direction) as string;

  let rows: Record<string, unknown>[];
  if (page <= 1) {
    rows = await execute(`SELECT ${columns} FROM ${table} ORDER BY ${column} ASC LIMIT ?`, [pageSize]);
  } else {
    const keyRows = await execute(
      'SELECT key FROM dataset_page_keys WHERE view = ? AND sort = ? AND direction = ? AND page = ?',
      pageKeyedArgs(view, sort, direction, page),
    );
    if (!keyRows.length) {
      throw new DatasetDatabaseError(
        'Dataset pagination key is missing',
        [
          `no dataset_page_keys row for view=${view} sort=${sort} direction=${direction} page=${page}`,
          'The database was uploaded without its page-key table; rebuild and re-upload it.',
        ].join('\n'),
      );
    }
    rows = await execute(`SELECT ${columns} FROM ${table} WHERE ${column} >= ? ORDER BY ${column} ASC LIMIT ?`, [
      String(keyRows[0].key),
      pageSize,
    ]);
  }

  return rows.map((row) => (view === 'works' ? toWorkRow(row) : toCandidateRow(row)));
}

export async function getDatasetPage({
  view,
  sort,
  direction,
  page,
}: {
  view: DatasetViewKey;
  sort: DatasetSortKey;
  direction: DatasetSortDirection;
  page: number;
}): Promise<DatasetPage> {
  const stats = await getDatasetStats();
  const total = view === 'works' ? stats.works_view_total : stats.candidates_total;
  const pageSize = view === 'works' ? stats.works_view_page_size : stats.candidates_page_size;
  const pageCount = Math.max(1, view === 'works' ? stats.works_view_page_count : stats.candidates_page_count);
  const safePage = Math.min(Math.max(1, page), pageCount);
  const rows = await getDatasetRowsPage({ view, sort, direction, page: safePage, pageSize });
  const references = view === 'works' ? await getDatasetReferences(collectPageReferenceIds(rows)) : [];

  return { view, sort, direction, page: safePage, pageSize, pageCount, total, rows, references };
}

// Serves any file stored in dataset_export_files: root files (manifests,
// dataset-summary.json, candidate-books.json) and the references grid pages
// (`references/pages/0001.json`, ...). The references pages are stored gzipped
// (8.4x); they are decompressed here so callers always get the exact file text.
export async function getStoredExportFile(name: string): Promise<string | null> {
  const rows = await execute('SELECT content, encoding FROM dataset_export_files WHERE name = ?', [name]);
  if (!rows.length) return null;
  const content = toBuffer(rows[0].content, `dataset_export_files.content (${name})`);
  const encoding = String(rows[0].encoding ?? 'utf8');
  if (encoding === 'gzip') return gunzipSync(content).toString('utf8');
  if (encoding === 'utf8') return content.toString('utf8');
  throw new DatasetDatabaseError(
    'Dataset export file has an unknown encoding',
    `name: ${name}, encoding: ${encoding} — rebuild and re-upload the dataset database.`,
  );
}

function toBuffer(value: unknown, context: string): Buffer {
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  throw new DatasetDatabaseError('Dataset row contains an unexpected binary value', `row/field: ${context}, type: ${typeof value}`);
}

export async function getDatasetExportPage({
  dataset,
  sort,
  direction,
  page,
}: {
  dataset: 'works' | 'candidate-books';
  sort: DatasetSortKey;
  direction: DatasetSortDirection;
  page: number;
}) {
  const view: DatasetViewKey = dataset === 'works' ? 'works' : 'candidates';
  const viewPage = await getDatasetPage({ view, sort, direction, page });
  const datasetName = dataset === 'works' ? 'works' : 'candidate-books';

  // rows keep the export file's field order (with undeclared extras merged back in)
  const rows = viewPage.rows.map((row) => buildExportRow(row));

  return {
    json:
      dataset === 'works'
        ? {
            format_version: 1,
            dataset: datasetName,
            sort,
            direction,
            page: viewPage.page,
            page_size: viewPage.pageSize,
            page_count: viewPage.pageCount,
            total: viewPage.total,
            rows,
            references: viewPage.references,
          }
        : {
            format_version: 1,
            dataset: datasetName,
            sort,
            direction,
            page: viewPage.page,
            page_size: viewPage.pageSize,
            page_count: viewPage.pageCount,
            total: viewPage.total,
            rows,
          },
    page: viewPage.page,
    pageCount: viewPage.pageCount,
    total: viewPage.total,
  };
}
