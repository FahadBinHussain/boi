import { NextResponse } from 'next/server';
import {
  DatasetDatabaseError,
  datasetSortDirections,
  datasetSortKeys,
  getDatasetExportPage,
  getDatasetStats,
  getStoredExportFile,
  type DatasetSortDirection,
  type DatasetSortKey,
} from '@/lib/dataset-db';

// Every path under /dataset/exports/* is served from the Turso database:
//   - root files (manifests, dataset-summary.json, candidate-books.json) and the
//     references grid pages are stored in dataset_export_files (references pages
//     gzipped 8.4x, decompressed on the way out)
//   - works|candidate-books pages are regenerated with the same keyset reads the
//     dataset page uses: one page-key read + one index range scan, no OFFSET
//
// The generated file grid on disk (2.7 GB, dataset/main/generated/exports) is the
// source the database was built from, not something the site reads at runtime.

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
const allowedSorts = new Set<string>(datasetSortKeys);
const allowedDirections = new Set<string>(datasetSortDirections);

const rootFileAliases = new Map([['books-manifest.json', 'works-manifest.json']]);
const datasetAliases = new Map([['books', 'works']]);

const exportHeaders = {
  'content-type': 'application/json; charset=utf-8',
  // dataset snapshots change only when the database is re-uploaded; let the CDN
  // absorb repeated crawls so they do not spend the free-tier row budget.
  'cache-control': 'public, s-maxage=600, stale-while-revalidate=3600',
};

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

function exportError(status: number, message: string, detail: string) {
  return NextResponse.json({ error: message, detail }, { status, headers: { 'cache-control': 'no-store' } });
}

function databaseErrorResponse(error: unknown) {
  if (error instanceof DatasetDatabaseError) {
    return exportError(503, error.message, error.detail);
  }
  return exportError(503, 'Dataset export unavailable', error instanceof Error ? `${error.name}: ${error.message}` : String(error));
}

export async function GET(_request: Request, context: RouteContext) {
  const { file } = await context.params;

  if (!isAllowedExportPath(file)) {
    return exportError(404, 'Dataset export not found', `path: ${file.join('/')}`);
  }

  try {
    if (file.length === 1) {
      const resolved = rootFileAliases.get(file[0]) || file[0];
      const content = await getStoredExportFile(resolved);
      if (content === null) {
        return exportError(
          404,
          'Dataset export file is missing from the database',
          `${resolved} is not stored in dataset_export_files; rebuild and upload the dataset database.`,
        );
      }
      return new NextResponse(content, { headers: exportHeaders });
    }

    const stats = await getDatasetStats();

    if (file.length === 3) {
      const [dataset, , fileName] = file;
      const page = Number(fileName.slice(0, 4));
      if (page < 1 || page > stats.references_page_count) {
        return exportError(404, 'Dataset export page not found', `${dataset} page ${page} is outside 1-${stats.references_page_count}`);
      }
      const content = await getStoredExportFile(`${dataset}/pages/${fileName}`);
      if (content === null) {
        return exportError(
          404,
          'Dataset export page is missing from the database',
          `${dataset}/pages/${fileName} is not stored in dataset_export_files; rebuild and upload the dataset database.`,
        );
      }
      return new NextResponse(content, { headers: exportHeaders });
    }

    const [dataset, , sort, direction, fileName] = file;
    const resolvedDataset = datasetAliases.get(dataset) || dataset;
    const page = Number(fileName.slice(0, 4));
    const pageCount = resolvedDataset === 'works' ? stats.works_view_page_count : stats.candidates_page_count;
    if (page < 1 || page > pageCount) {
      return exportError(404, 'Dataset export page not found', `${dataset} page ${page} is outside 1-${pageCount}`);
    }

    const result = await getDatasetExportPage({
      dataset: resolvedDataset === 'works' ? 'works' : 'candidate-books',
      sort: sort as DatasetSortKey,
      direction: direction as DatasetSortDirection,
      page,
    });
    return NextResponse.json(result.json, { headers: exportHeaders });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
