// Shared schema/ordering contract between the DB builder and the app.
//
// The /dataset page is served from a Turso (libSQL/SQLite) database built by
// dataset/scripts/build-dataset-db.mjs. Every list view is paginated with a
// KEYSET cursor, never OFFSET, because Turso bills "rows read" (rows touched
// by the query), not rows returned.
//
// Ordering contract:
//   - every row stores its RANK in each (sort, direction) ordering
//     (`k_title_asc`, `k_title_desc`, `k_year_asc`, ...), zero-padded so plain
//     text comparison keeps numeric order
//   - ranks are assigned with sortBookRows(), which mirrors the comparator in
//     dataset/scripts/generate-exports.js, so ordering by rank reproduces the
//     published export page files exactly - ICU localeCompare collation,
//     tie-breaks and "missing last" included
//   - every key is compared ASCENDING; direction is baked into the rank
//
// The build script also writes dataset_page_keys (the first rank of every page)
// so that jumping to page N costs one tiny lookup + one index range scan
// instead of scanning everything before the page.

export const WORKS_PAGE_SIZE = 250;
export const CANDIDATES_PAGE_SIZE = 250;
export const REFERENCES_PAGE_SIZE = 10000;

export const SORT_KEYS = ['title', 'author', 'year', 'editions'];
export const SORT_DIRECTIONS = ['asc', 'desc'];

// 7 digits covers up to 9,999,999 rows in one view.
export const SORT_KEY_WIDTH = 7;

export const DATASET_VIEWS = {
  works: { table: 'dataset_works', exportRoot: 'works', pageSize: WORKS_PAGE_SIZE, label: 'books' },
  candidates: { table: 'dataset_candidates', exportRoot: 'candidate-books', pageSize: CANDIDATES_PAGE_SIZE, label: 'candidate books' },
};

export function sortKeyColumn(sort, direction) {
  if (!SORT_KEYS.includes(sort)) throw new Error(`Unknown sort key: ${sort}`);
  if (!SORT_DIRECTIONS.includes(direction)) throw new Error(`Unknown sort direction: ${direction}`);
  return `k_${sort}_${direction}`;
}

export function keyForRank(rank) {
  return String(rank).padStart(SORT_KEY_WIDTH, '0');
}

export function pageStartRank(page, pageSize) {
  return (page - 1) * pageSize + 1;
}

// The eight key columns every list table must carry (one per sort+direction).
export const SORT_KEY_COLUMNS = SORT_KEYS.flatMap((sort) => SORT_DIRECTIONS.map((direction) => sortKeyColumn(sort, direction)));

// ---------------------------------------------------------------- comparator
//
// Mirror of dataset/scripts/generate-exports.js (displayTitle/displayAuthors/
// compareText/compareNumber/sortBookRows). The build script proves it is still
// identical by comparing generated pages against the published export files, so
// a drift here fails the build loudly instead of reshuffling the live site.

function displayTitle(work) {
  return work.title_bn || work.title_en || work.id;
}

function displayAuthors(work) {
  return (work.authors || []).map((author) => author.name_bn || author.name_en || author.id).join(', ');
}

function compareText(a, b, direction) {
  const result = String(a || '').localeCompare(String(b || ''), ['bn', 'en'], {
    sensitivity: 'base',
    numeric: true,
  });
  return direction === 'asc' ? result : -result;
}

function compareNumber(a, b, direction) {
  const emptyA = a === null || a === undefined;
  const emptyB = b === null || b === undefined;
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;
  const result = a - b;
  return direction === 'asc' ? result : -result;
}

export function sortBookRows(rows, sort, direction) {
  return rows.slice().sort((a, b) => {
    if (sort === 'author') {
      return compareText(displayAuthors(a), displayAuthors(b), direction) || compareText(displayTitle(a), displayTitle(b), 'asc');
    }

    if (sort === 'year') {
      return compareNumber(a.first_published_year, b.first_published_year, direction) || compareText(displayTitle(a), displayTitle(b), 'asc');
    }

    if (sort === 'editions') {
      return compareNumber(a.edition_count, b.edition_count, direction) || compareText(displayTitle(a), displayTitle(b), 'asc');
    }

    return compareText(displayTitle(a), displayTitle(b), direction) || compareText(displayAuthors(a), displayAuthors(b), 'asc');
  });
}

// Ranks every row of one (sort, direction) ordering: id -> zero-padded rank.
export function rankRows(rows, sort, direction) {
  const ranks = new Map();
  sortBookRows(rows, sort, direction).forEach((row, index) => {
    ranks.set(row.id, keyForRank(index + 1));
  });
  return ranks;
}
