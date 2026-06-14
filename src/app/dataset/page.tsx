import Link from 'next/link';
import { headers } from 'next/headers';
import { FiArchive, FiBookOpen, FiChevronLeft, FiChevronRight, FiDatabase, FiDownloadCloud } from 'react-icons/fi';

type DatasetWork = {
  id: string;
  title_bn: string | null;
  title_en: string | null;
  first_published_year: number | null;
  source_refs: string[];
  source_count?: number;
  edition_source_refs?: string[];
  confidence: number;
  edition_count: number;
  authors: Array<{
    id: string;
    name_bn: string | null;
    name_en: string | null;
    role: string;
    source_refs?: string[];
  }>;
};

type DatasetCandidateBook = {
  id: string;
  normalized_work_id: string;
  title_bn: string | null;
  title_en: string | null;
  first_published_year: number | null;
  source_refs: string[];
  confidence: number;
  edition_count: number;
  verification_status: 'pending' | 'verified' | 'rejected';
  reason: string | null;
  sources: Array<{
    label: string;
    url: string;
    retrieved_at: string;
    notes: string;
  }>;
  authors: Array<{
    id: string;
    name_bn: string | null;
    name_en: string | null;
    role: string;
  }>;
};

type DatasetBookRow = DatasetWork | DatasetCandidateBook;

type DatasetReference = {
  id: string;
  source: string;
  url: string | null;
  record_type: string;
  raw_title: string | null;
};

type DatasetPageManifest = {
  total: number;
  page_size: number;
  page_count: number;
};

type DatasetPageExport = {
  rows: DatasetBookRow[];
  references?: DatasetReference[];
};

type ExportFile = {
  name: string;
  href: string;
  label: string;
};

const exportFiles: ExportFile[] = [
  { name: 'books-manifest.json', href: '/dataset/exports/books-manifest.json', label: 'Books Manifest' },
  { name: 'candidate-books-manifest.json', href: '/dataset/exports/candidate-books-manifest.json', label: 'Candidate Books Manifest' },
  { name: 'candidate-books.json', href: '/dataset/exports/candidate-books.json', label: 'Full Candidate Books JSON' },
];

const sortKeys = ['title', 'author', 'year', 'editions'] as const;
const sortDirections = ['asc', 'desc'] as const;
const viewKeys = ['books', 'candidates'] as const;
const datasetAssetBasePath = '/dataset-assets/exports';

type SortKey = (typeof sortKeys)[number];
type SortDirection = (typeof sortDirections)[number];
type DatasetView = (typeof viewKeys)[number];

function isSortKey(value: string | undefined): value is SortKey {
  return Boolean(value && sortKeys.includes(value as SortKey));
}

function isSortDirection(value: string | undefined): value is SortDirection {
  return Boolean(value && sortDirections.includes(value as SortDirection));
}

function isDatasetView(value: string | undefined): value is DatasetView {
  return Boolean(value && viewKeys.includes(value as DatasetView));
}

function isCandidateRow(work: DatasetBookRow): work is DatasetCandidateBook {
  return 'verification_status' in work;
}

function pageFileName(page: number) {
  return `${String(page).padStart(4, '0')}.json`;
}

function SortHeader({
  label,
  column,
  activeSort,
  direction,
  view,
}: {
  label: string;
  column: SortKey;
  activeSort: SortKey;
  direction: SortDirection;
  view: DatasetView;
}) {
  const isActive = activeSort === column;
  const nextDirection: SortDirection = isActive && direction === 'asc' ? 'desc' : 'asc';
  const indicator = isActive ? (direction === 'asc' ? '↑' : '↓') : '↕';

  return (
    <Link
      href={`/dataset?view=${view}&sort=${column}&dir=${nextDirection}`}
      className="inline-flex w-full items-center justify-between gap-3 text-left transition hover:text-[#171510] dark:hover:text-white"
      aria-label={`Sort by ${label} ${nextDirection === 'asc' ? 'ascending' : 'descending'}`}
    >
      <span>{label}</span>
      <span className={`text-[11px] ${isActive ? 'text-[#171510] dark:text-white' : 'text-[#9b8d7a] dark:text-white/35'}`}>{indicator}</span>
    </Link>
  );
}

function CandidateRefMarks({ sources }: { sources: DatasetCandidateBook['sources'] }) {
  if (!sources.length) return null;

  return (
    <sup className="ml-1 inline-flex translate-y-[-0.15em] flex-wrap gap-1 align-super text-[10px] font-semibold leading-none">
      {sources.map((source, index) =>
        source.url ? (
          <a
            key={`${source.url}-${index}`}
            href={source.url}
            target="_blank"
            rel="noreferrer noopener"
            title={`${source.label}: ${source.notes}`}
            className="text-[#0757b8] hover:underline dark:text-sky-300"
          >
            [{index + 1}]
          </a>
        ) : (
          <span key={`${source.label}-${index}`} title={`${source.label}: ${source.notes}`} className="text-[#0757b8] dark:text-sky-300">
            [{index + 1}]
          </span>
        )
      )}
    </sup>
  );
}

function RefMarks({
  refs,
  referenceNumbers,
  referencesById,
}: {
  refs: string[];
  referenceNumbers: Map<string, number>;
  referencesById: Map<string, DatasetReference>;
}) {
  const uniqueRefs = Array.from(new Set(refs)).filter((ref) => referenceNumbers.has(ref));

  if (!uniqueRefs.length) return null;

  return (
    <sup className="ml-1 inline-flex translate-y-[-0.15em] flex-wrap gap-1 align-super text-[10px] font-semibold leading-none">
      {uniqueRefs.map((ref) => {
        const reference = referencesById.get(ref);
        const label = `[${referenceNumbers.get(ref)}]`;
        return reference?.url ? (
          <a
            key={ref}
            href={reference.url}
            target="_blank"
            rel="noreferrer noopener"
            title={`${reference.source}: ${reference.raw_title || reference.record_type}`}
            className="text-[#0757b8] hover:underline dark:text-sky-300"
          >
            {label}
          </a>
        ) : (
          <span key={ref} title={reference ? `${reference.source}: ${reference.raw_title || reference.record_type}` : ref} className="text-[#0757b8] dark:text-sky-300">
            {label}
          </span>
        );
      })}
    </sup>
  );
}

function encodeDatasetAssetPath(relativePath: string) {
  return relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function getRequestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host');

  if (host) {
    const protocol =
      requestHeaders.get('x-forwarded-proto') ||
      (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');

    return `${protocol}://${host}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:3000';
}

async function readJson<T>(relativePath: string): Promise<T> {
  const origin = await getRequestOrigin();
  const url = new URL(`${datasetAssetBasePath}/${encodeDatasetAssetPath(relativePath)}`, origin);
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Failed to load dataset export ${relativePath}: ${response.status}`);
  }

  return (await response.json()) as T;
}

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dataset - বই',
  description: 'Source-backed Bangla books dataset status and exports.',
};

export default async function DatasetPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; sort?: string; dir?: string; view?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params?.page || 1) || 1);
  const view = isDatasetView(params?.view) ? params.view : 'books';
  const sort = isSortKey(params?.sort) ? params.sort : 'title';
  const direction = isSortDirection(params?.dir) ? params.dir : 'asc';
  const datasetName = view === 'candidates' ? 'candidate-books' : 'works';
  const manifest = await readJson<DatasetPageManifest>(`${datasetName}-manifest.json`);
  const totalWorkPages = Math.max(1, manifest.page_count);
  const safeCurrentPage = Math.min(currentPage, totalWorkPages);
  const pageData = await readJson<DatasetPageExport>(`${datasetName}/pages/${sort}/${direction}/${pageFileName(safeCurrentPage)}`);
  const referencesById = new Map((pageData.references || []).map((reference) => [reference.id, reference]));
  const visibleWorks = pageData.rows;
  const totalRows = manifest.total;
  const pageSize = manifest.page_size;
  const pageQuery = `view=${view}&sort=${sort}&dir=${direction}`;
  const viewLabel = view === 'candidates' ? 'candidate books' : 'books';
  const visibleRangeStart = totalRows === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const visibleRangeEnd = totalRows === 0 ? 0 : Math.min(safeCurrentPage * pageSize, totalRows);

  return (
    <div className="min-h-screen bg-[#f6f3ec] text-[#171510] dark:bg-[#0c1017] dark:text-white">
      <section className="border-b border-[#d8d0c2] bg-[#fbfaf6] dark:border-white/10 dark:bg-[#111722]">
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 border border-[#d7cdbd] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#6b5d48] dark:border-white/10 dark:bg-white/5 dark:text-white/55">
                <FiDatabase aria-hidden="true" />
                Books Dataset
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#171510] dark:text-white sm:text-3xl">Source-backed Bangla books</h1>
              <p className="mt-1 text-sm text-[#6b5d48] dark:text-white/55">
                {totalRows.toLocaleString()} {viewLabel} / showing {visibleRangeStart.toLocaleString()}-{visibleRangeEnd.toLocaleString()}
              </p>
            </div>
            <nav aria-label="Dataset navigation" className="flex flex-col gap-2 border border-[#d8d0c2] bg-white p-2 shadow-[0_12px_30px_-28px_rgba(23,21,16,0.65)] dark:border-white/10 dark:bg-white/[0.04] md:flex-row md:items-center">
              <div className="grid grid-cols-2 gap-1 bg-[#f2eadc] p-1 dark:bg-white/[0.06]">
                <Link
                  href={`/dataset?view=books&sort=${sort}&dir=${direction}`}
                  className={`inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold transition ${view === 'books' ? 'bg-[#171510] text-white dark:bg-white dark:text-[#111722]' : 'text-[#5f5447] hover:bg-white hover:text-[#171510] dark:text-white/65 dark:hover:bg-white/10 dark:hover:text-white'}`}
                >
                  <FiBookOpen aria-hidden="true" />
                  Books
                </Link>
                <Link
                  href={`/dataset?view=candidates&sort=${sort}&dir=${direction}`}
                  className={`inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold transition ${view === 'candidates' ? 'bg-[#171510] text-white dark:bg-white dark:text-[#111722]' : 'text-[#5f5447] hover:bg-white hover:text-[#171510] dark:text-white/65 dark:hover:bg-white/10 dark:hover:text-white'}`}
                >
                  <FiArchive aria-hidden="true" />
                  Candidates
                </Link>
              </div>
              <div className="hidden h-8 w-px bg-[#d8d0c2] dark:bg-white/10 md:block" />
              <div className="flex flex-wrap gap-1">
                {exportFiles.map((file) => (
                  <Link
                    key={file.name}
                    href={file.href}
                    className="inline-flex items-center gap-2 border border-[#c9bfaf] bg-[#fbfaf6] px-3 py-2 text-xs font-semibold text-[#171510] transition hover:border-[#7c6e58] hover:bg-[#f2eadc] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  >
                    <FiDownloadCloud aria-hidden="true" />
                    {file.label}
                  </Link>
                ))}
              </div>
              <div className="hidden h-8 w-px bg-[#d8d0c2] dark:bg-white/10 md:block" />
              <div className="grid grid-cols-2 gap-1">
                <Link
                  href={`/dataset?${pageQuery}&page=${Math.max(1, safeCurrentPage - 1)}`}
                  className={`inline-flex items-center justify-center gap-2 border px-3 py-2 text-xs font-semibold ${safeCurrentPage === 1 ? 'pointer-events-none border-[#e7dfd2] text-[#a89b8a] dark:border-white/10 dark:text-white/30' : 'border-[#c9bfaf] bg-[#fbfaf6] text-[#171510] hover:bg-[#f2eadc] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'}`}
                >
                  <FiChevronLeft aria-hidden="true" />
                  Previous
                </Link>
                <Link
                  href={`/dataset?${pageQuery}&page=${Math.min(totalWorkPages, safeCurrentPage + 1)}`}
                  className={`inline-flex items-center justify-center gap-2 border px-3 py-2 text-xs font-semibold ${safeCurrentPage === totalWorkPages ? 'pointer-events-none border-[#e7dfd2] text-[#a89b8a] dark:border-white/10 dark:text-white/30' : 'border-[#c9bfaf] bg-[#fbfaf6] text-[#171510] hover:bg-[#f2eadc] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'}`}
                >
                  Next
                  <FiChevronRight aria-hidden="true" />
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="border border-[#d8d0c2] bg-white dark:border-white/10 dark:bg-white/[0.03]">
          <div className="dataset-table-scroll max-h-[calc(100dvh-260px)] overflow-auto">
          <table className="min-w-[1180px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-20 bg-[#fbfaf6] text-xs uppercase tracking-[0.12em] text-[#6b5d48] shadow-[0_1px_0_#e7dfd2] dark:bg-[#111722] dark:text-white/55 dark:shadow-[0_1px_0_rgba(255,255,255,0.1)]">
              <tr>
                <th className="w-12 border-b border-r border-[#e7dfd2] px-3 py-3 dark:border-white/10">#</th>
                <th className="w-[42%] border-b border-r border-[#e7dfd2] px-3 py-3 dark:border-white/10">
                  <SortHeader label="Title" column="title" activeSort={sort} direction={direction} view={view} />
                </th>
                <th className="w-[34%] border-b border-r border-[#e7dfd2] px-3 py-3 dark:border-white/10">
                  <SortHeader label="Authors" column="author" activeSort={sort} direction={direction} view={view} />
                </th>
                <th className="w-28 border-b border-r border-[#e7dfd2] px-3 py-3 dark:border-white/10">
                  <SortHeader label="Year" column="year" activeSort={sort} direction={direction} view={view} />
                </th>
                <th className="w-28 border-b border-[#e7dfd2] px-3 py-3 dark:border-white/10">
                  <SortHeader label="Editions" column="editions" activeSort={sort} direction={direction} view={view} />
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleWorks.map((work, index) => {
                const isCandidate = isCandidateRow(work);
                const rowSourceRefs = Array.from(
                  new Set(
                    isCandidate
                      ? work.source_refs
                      : [
                          ...work.source_refs,
                          ...(work.edition_source_refs || []),
                          ...work.authors.flatMap((author) => author.source_refs || []),
                        ]
                  )
                );
                const referenceNumbers = new Map(rowSourceRefs.map((ref, refIndex) => [ref, refIndex + 1]));
                const primaryTitle = work.title_bn || work.title_en;
                const secondaryTitle = work.title_bn && work.title_en && work.title_en !== work.title_bn ? work.title_en : null;
                const titleRefs = isCandidate ? (
                  <CandidateRefMarks sources={work.sources} />
                ) : (
                  <RefMarks refs={work.source_refs} referenceNumbers={referenceNumbers} referencesById={referencesById} />
                );
                return (
                  <tr key={work.id} className="align-top odd:bg-white even:bg-[#fbf8f1] hover:bg-[#f1eadf] dark:odd:bg-transparent dark:even:bg-white/[0.03] dark:hover:bg-white/[0.07]">
                    <td className="border-r border-[#e7dfd2] px-3 py-2 text-[#786b59] tabular-nums dark:border-white/10 dark:text-white/45">{(safeCurrentPage - 1) * pageSize + index + 1}</td>
                    <td className="border-r border-[#e7dfd2] px-3 py-2 dark:border-white/10">
                      <div className="font-semibold leading-6">
                        {primaryTitle}
                        {titleRefs}
                      </div>
                      {secondaryTitle ? (
                        <div className="mt-0.5 text-xs text-[#786b59] dark:text-white/45">
                          {secondaryTitle}
                        </div>
                      ) : null}
                      {isCandidate ? (
                        <div className="mt-2 max-w-3xl text-xs leading-5 text-[#786b59] dark:text-white/45">
                          <span className="font-semibold uppercase tracking-[0.12em] text-[#8a6a1d] dark:text-amber-200">{work.verification_status}</span>
                          {work.reason ? ` - ${work.reason}` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="border-r border-[#e7dfd2] px-3 py-2 text-[#3f382d] dark:border-white/10 dark:text-white/75">
                      {work.authors.length ? (
                        <div className="flex flex-wrap gap-x-2 gap-y-1">
                          {work.authors.map((author, authorIndex) => (
                            <span key={`${author.id}-${author.role}`}>
                              {author.name_bn || author.name_en || author.id}
                              {isCandidate ? null : <RefMarks refs={('source_refs' in author ? author.source_refs : undefined) || work.source_refs} referenceNumbers={referenceNumbers} referencesById={referencesById} />}
                              {authorIndex < work.authors.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="border-r border-[#e7dfd2] px-3 py-2 tabular-nums dark:border-white/10">
                      {work.first_published_year || ''}
                      {!isCandidate && work.first_published_year ? <RefMarks refs={work.edition_source_refs || work.source_refs} referenceNumbers={referenceNumbers} referencesById={referencesById} /> : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {work.edition_count}
                      {!isCandidate ? <RefMarks refs={work.edition_source_refs || work.source_refs} referenceNumbers={referenceNumbers} referencesById={referencesById} /> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-[#d8d0c2] bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
          <div className="text-[#5f5447] dark:text-white/60">
            Page {safeCurrentPage.toLocaleString()} of {totalWorkPages.toLocaleString()}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/dataset?${pageQuery}&page=${Math.max(1, safeCurrentPage - 1)}`}
              className={`border px-3 py-2 text-xs font-semibold ${safeCurrentPage === 1 ? 'pointer-events-none border-[#e7dfd2] text-[#a89b8a] dark:border-white/10 dark:text-white/30' : 'border-[#c9bfaf] text-[#171510] hover:bg-[#f2eadc] dark:border-white/10 dark:text-white dark:hover:bg-white/10'}`}
            >
              Previous
            </Link>
            <Link
              href={`/dataset?${pageQuery}&page=${Math.min(totalWorkPages, safeCurrentPage + 1)}`}
              className={`border px-3 py-2 text-xs font-semibold ${safeCurrentPage === totalWorkPages ? 'pointer-events-none border-[#e7dfd2] text-[#a89b8a] dark:border-white/10 dark:text-white/30' : 'border-[#c9bfaf] text-[#171510] hover:bg-[#f2eadc] dark:border-white/10 dark:text-white dark:hover:bg-white/10'}`}
            >
              Next
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
