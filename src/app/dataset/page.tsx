import Link from 'next/link';
import { headers } from 'next/headers';
import { FiArchive, FiBookOpen, FiChevronLeft, FiChevronRight, FiDatabase, FiDownloadCloud, FiAlertCircle } from 'react-icons/fi';
import MotionIcon from '@/components/ui/MotionIcon';

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
      className="inline-flex w-full items-center justify-between gap-3 text-left transition hover:text-primary font-bold"
      aria-label={`Sort by ${label} ${nextDirection === 'asc' ? 'ascending' : 'descending'}`}
    >
      <span>{label}</span>
      <span className={`text-[11px] ${isActive ? 'text-primary font-extrabold' : 'opacity-40'}`}>{indicator}</span>
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
            className="text-primary hover:underline"
          >
            [{index + 1}]
          </a>
        ) : (
          <span key={`${source.label}-${index}`} title={`${source.label}: ${source.notes}`} className="text-primary">
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
            className="text-primary hover:underline"
          >
            {label}
          </a>
        ) : (
          <span key={ref} title={reference ? `${reference.source}: ${reference.raw_title || reference.record_type}` : ref} className="text-primary">
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

function DatasetExportError({ detail }: { detail: string }) {
  return (
    <div className="min-h-screen bg-base-100 text-base-content py-12 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="alert alert-error shadow-xl rounded-3xl">
          <MotionIcon animation="wiggle" trigger="always">
            <FiAlertCircle className="w-8 h-8 shrink-0" />
          </MotionIcon>
          <div>
            <h1 className="text-xl font-bold">Dataset exports unavailable</h1>
            <p className="text-sm mt-1">/dataset cannot load its export assets</p>
            <pre className="mt-3 overflow-x-auto bg-base-300/60 p-3 rounded-lg text-xs font-mono">{detail}</pre>
            <p className="mt-3 text-xs opacity-80">
              Expected files under <code>/dataset-assets/exports/</code>. Run <code>pnpm dataset:export && pnpm build</code> locally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  let manifest: DatasetPageManifest;
  let pageData: DatasetPageExport;
  let safeCurrentPage: number;
  let totalWorkPages: number;
  try {
    manifest = await readJson<DatasetPageManifest>(`${datasetName}-manifest.json`);
    totalWorkPages = Math.max(1, manifest.page_count);
    safeCurrentPage = Math.min(currentPage, totalWorkPages);
    pageData = await readJson<DatasetPageExport>(`${datasetName}/pages/${sort}/${direction}/${pageFileName(safeCurrentPage)}`);
  } catch (error) {
    const detail = [
      `view=${view}`,
      `missing or unreadable export assets under ${datasetAssetBasePath}/`,
      '',
      error instanceof Error ? error.message : String(error),
    ].join('\n');
    return <DatasetExportError detail={detail} />;
  }

  const referencesById = new Map((pageData.references || []).map((reference) => [reference.id, reference]));
  const visibleWorks = pageData.rows;
  const totalRows = manifest.total;
  const pageSize = manifest.page_size;
  const pageQuery = `view=${view}&sort=${sort}&dir=${direction}`;
  const viewLabel = view === 'candidates' ? 'candidate books' : 'books';
  const visibleRangeStart = totalRows === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const visibleRangeEnd = totalRows === 0 ? 0 : Math.min(safeCurrentPage * pageSize, totalRows);

  return (
    <div className="min-h-screen bg-base-100 text-base-content transition-colors">
      <section className="border-b border-base-200 bg-base-200/50">
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 badge badge-outline border-base-content/20 bg-base-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-base-content/70">
                <MotionIcon animation="pulse" trigger="hover">
                  <FiDatabase aria-hidden="true" />
                </MotionIcon>
                Books Dataset
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-base-content sm:text-3xl">Source-backed Bangla books</h1>
              <p className="mt-1 text-sm text-base-content/60">
                {totalRows.toLocaleString()} {viewLabel} / showing {visibleRangeStart.toLocaleString()}-{visibleRangeEnd.toLocaleString()}
              </p>
            </div>
            <nav aria-label="Dataset navigation" className="flex flex-col gap-2 rounded-2xl border border-base-content/10 bg-base-100 p-2 shadow-sm md:flex-row md:items-center">
              <div className="join">
                <Link
                  href={`/dataset?view=books&sort=${sort}&dir=${direction}`}
                  className={`btn btn-sm join-item ${view === 'books' ? 'btn-primary' : 'btn-ghost'}`}
                >
                  <MotionIcon animation="float" trigger="hover">
                    <FiBookOpen aria-hidden="true" />
                  </MotionIcon>
                  Books
                </Link>
                <Link
                  href={`/dataset?view=candidates&sort=${sort}&dir=${direction}`}
                  className={`btn btn-sm join-item ${view === 'candidates' ? 'btn-primary' : 'btn-ghost'}`}
                >
                  <MotionIcon animation="wiggle" trigger="hover">
                    <FiArchive aria-hidden="true" />
                  </MotionIcon>
                  Candidates
                </Link>
              </div>
              <div className="hidden h-6 w-px bg-base-content/10 md:block" />
              <div className="flex flex-wrap gap-1">
                {exportFiles.map((file) => (
                  <Link
                    key={file.name}
                    href={file.href}
                    className="btn btn-outline btn-xs gap-1.5"
                  >
                    <MotionIcon animation="bounce" trigger="hover">
                      <FiDownloadCloud aria-hidden="true" />
                    </MotionIcon>
                    {file.label}
                  </Link>
                ))}
              </div>
              <div className="hidden h-6 w-px bg-base-content/10 md:block" />
              <div className="join">
                <Link
                  href={`/dataset?${pageQuery}&page=${Math.max(1, safeCurrentPage - 1)}`}
                  className={`btn btn-outline btn-xs join-item ${safeCurrentPage === 1 ? 'btn-disabled opacity-40' : ''}`}
                >
                  <MotionIcon animation="bounce" trigger="hover">
                    <FiChevronLeft aria-hidden="true" />
                  </MotionIcon>
                  Prev
                </Link>
                <Link
                  href={`/dataset?${pageQuery}&page=${Math.min(totalWorkPages, safeCurrentPage + 1)}`}
                  className={`btn btn-outline btn-xs join-item ${safeCurrentPage === totalWorkPages ? 'btn-disabled opacity-40' : ''}`}
                >
                  Next
                  <MotionIcon animation="bounce" trigger="hover">
                    <FiChevronRight aria-hidden="true" />
                  </MotionIcon>
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="card bg-base-100 border border-base-content/10 shadow-sm rounded-2xl overflow-hidden">
          <div className="dataset-table-scroll max-h-[calc(100dvh-260px)] overflow-auto">
          <table className="table table-zebra table-sm table-pin-rows">
            <thead>
              <tr className="bg-base-200 text-base-content/70">
                <th className="w-12">#</th>
                <th className="w-[42%]">
                  <SortHeader label="Title" column="title" activeSort={sort} direction={direction} view={view} />
                </th>
                <th className="w-[34%]">
                  <SortHeader label="Authors" column="author" activeSort={sort} direction={direction} view={view} />
                </th>
                <th className="w-28">
                  <SortHeader label="Year" column="year" activeSort={sort} direction={direction} view={view} />
                </th>
                <th className="w-28">
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
                  <tr key={work.id} className="hover">
                    <td className="opacity-50 tabular-nums">{(safeCurrentPage - 1) * pageSize + index + 1}</td>
                    <td>
                      <div className="font-semibold leading-6">
                        {primaryTitle}
                        {titleRefs}
                      </div>
                      {secondaryTitle ? (
                        <div className="mt-0.5 text-xs opacity-60">
                          {secondaryTitle}
                        </div>
                      ) : null}
                      {isCandidate ? (
                        <div className="mt-1.5 max-w-3xl text-xs opacity-70">
                          <span className="badge badge-warning badge-xs font-semibold uppercase">{work.verification_status}</span>
                          {work.reason ? ` - ${work.reason}` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td>
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
                    <td className="tabular-nums">
                      {work.first_published_year || ''}
                      {!isCandidate && work.first_published_year ? <RefMarks refs={work.edition_source_refs || work.source_refs} referenceNumbers={referenceNumbers} referencesById={referencesById} /> : null}
                    </td>
                    <td className="tabular-nums">
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 card bg-base-100 border border-base-content/10 px-4 py-3 text-sm rounded-xl">
          <div className="text-base-content/60">
            Page {safeCurrentPage.toLocaleString()} of {totalWorkPages.toLocaleString()}
          </div>
          <div className="join">
            <Link
              href={`/dataset?${pageQuery}&page=${Math.max(1, safeCurrentPage - 1)}`}
              className={`btn btn-outline btn-xs join-item ${safeCurrentPage === 1 ? 'btn-disabled opacity-40' : ''}`}
            >
              Previous
            </Link>
            <Link
              href={`/dataset?${pageQuery}&page=${Math.min(totalWorkPages, safeCurrentPage + 1)}`}
              className={`btn btn-outline btn-xs join-item ${safeCurrentPage === totalWorkPages ? 'btn-disabled opacity-40' : ''}`}
            >
              Next
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
