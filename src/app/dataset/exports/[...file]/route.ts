import { NextResponse } from 'next/server';

const allowedRootFiles = new Set([
  'books-manifest.json',
  'works-manifest.json',
  'candidate-books.json',
  'candidate-books-manifest.json',
  'references-manifest.json',
  'dataset-summary.json',
]);

const allowedDatasets = new Set(['books', 'works', 'candidate-books']);
const allowedPagedDatasets = new Set(['references']);
const allowedSorts = new Set(['title', 'author', 'year', 'editions']);
const allowedDirections = new Set(['asc', 'desc']);

const rootFileAliases = new Map([
  ['books-manifest.json', 'works-manifest.json'],
]);

const datasetAliases = new Map([['books', 'works']]);

type RouteContext = {
  params: Promise<{
    file: string[];
  }>;
};

function hasUnsafeSegment(segments: string[]) {
  return segments.some((segment) => !segment || segment === '..' || segment.includes('/') || segment.includes('\\') || segment.includes('\0'));
}

function isAllowedExportPath(segments: string[]) {
  if (hasUnsafeSegment(segments)) return false;

  if (segments.length === 1) {
    return allowedRootFiles.has(segments[0]);
  }

  if (segments.length === 5) {
    const [dataset, pages, sort, direction, fileName] = segments;
    return (
      allowedDatasets.has(dataset) &&
      pages === 'pages' &&
      allowedSorts.has(sort) &&
      allowedDirections.has(direction) &&
      /^\d{4}\.json$/.test(fileName)
    );
  }

  if (segments.length === 3) {
    const [dataset, pages, fileName] = segments;
    return allowedPagedDatasets.has(dataset) && pages === 'pages' && /^\d{4}\.json$/.test(fileName);
  }

  return false;
}

function resolveExportPath(segments: string[]) {
  if (segments.length === 1) {
    return [rootFileAliases.get(segments[0]) || segments[0]];
  }

  if (segments.length === 5) {
    const [dataset, ...rest] = segments;
    return [datasetAliases.get(dataset) || dataset, ...rest];
  }

  return segments;
}

export async function GET(_request: Request, context: RouteContext) {
  const { file } = await context.params;

  if (!isAllowedExportPath(file)) {
    return NextResponse.json({ error: 'Dataset export not found' }, { status: 404 });
  }

  const resolvedFile = resolveExportPath(file);
  const assetPath = `/dataset-assets/exports/${resolvedFile.map((segment) => encodeURIComponent(segment)).join('/')}`;
  return NextResponse.redirect(new URL(assetPath, _request.url), 307);
}
