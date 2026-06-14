# scraped sites

_kept at project root so both codex and i can see what we have_

two numbers for each site:
- **archive raw** = what the scraper actually collected
- **source_records** = what was imported into the main dataset after dedup/processing

## bengali book stores/retailers

| site | archive raw | source_records | notes |
|------|-------------|----------------|-------|
| allboi.com | 10,467 | 1+ | sitemap scrape, 35 errors |
| amarbooks.com | 3,285 | 82 | 18 errors, deduped heavily |
| banglabooks.in | 1,638 | 1+ | WordPress sitemap/API |
| banglabook.org | **2,247** | 1+ | reconcile: 763 exact, 538 title-only, 61 likely dupes, 48 possible, 837 not found in main |
| banglaboipdf.com | 565 | 24 | WordPress API |
| bdebooks.com | 11,680 | 186 | WordPress API + sitemap |
| books.com.bd | **29,332** | 2,833+ | jun 11 rescrape: 29,332 list book cards + 2,096 author book cards = 29,326 promoted |
| granthagara.com | 23,172 | 23,099 | 0 errors |
| rokomari.com (live sitemap) | 221k book URLs, 77k author URLs | 6,137+ | URL inventory only; 7 detail pages fetched as pilot |
| rokomari.com (HF dataset) | 20,000 books (raw sample) | 16,957 + 219 | 20k raw, 17k deduped into main dataset |

## medium retailers

_scraped jun 2026_

| site | archive raw | source_records |
|------|-------------|----------------|
| boibazar.com | 105,240 | 105,144 |
| baatighar.com | 89,620 | 89,472 |
| wafilife.com | 64,099 | 63,282 |
| eboighar.com | 20,000 | 19,982 |
| **total** | **278,959** | **277,880** |

## strong retailers

_scraped jun 2026_

| site | archive raw | source_records |
|------|-------------|----------------|
| pbs.com.bd | 21,759 | 21,654 |
| prothoma.com | 33,918 | 33,744 |
| kitabghor.com | 32,824 | 32,617 |
| bdbooks.net | 15,665 | 15,585 |
| **total** | **104,166** | **103,600** |

## small islamic sources

| site | archive raw | source_records |
|------|-------------|----------------|
| hadith.one | 801 | 794+ |
| islamhouse.com | 564 | 553+ |
| yshamsan.com | 221 | 220+ |
| **total** | **1,586** | **~1,570** |

## archives/catalogs

| site | archive raw | source_records | notes |
|------|-------------|----------------|-------|
| internet-archive.org | 2,622 | 6,310+ | jun 11 rescrape with IA_LIMIT=3000; quality-filtered to 2,622 with creators+title |
| openlibrary.org | 4,346 | 5,861+ | jun 11 rescrape with OPENLIBRARY_LIMIT=5000 |
| wikidata.org | 10,000 | 2,403+ | jun 11 rescrape with WIKIDATA_LIMIT=10000 |
| wikimedia commons | 11,978 ws + 11,976 commons | 11,985 + 5,353 | 0 errors |
| dli-ndli | 7,784 catalog entries | 4,940 | full catalog HTML captured; 4,940 imported |
| loc-franklin | 323 guide rows + 5 MARCXML | 769+ | guide rows + accession list + MARCXML records |
| nbil | 38+ matches | — | reference research, not a live scrape |
| authors.com.bd | 2,077 books | — | author link extract |

## research/reference (not scrape targets)

| folder | purpose |
|--------|---------|
| `candidate_source_research/` | agent research batches per source |
| `notion-zafar-iqbal/` | zafar iqbal bibliography from notion |
| `top-bangla-writers-bibliography/` | top 100 writers deep research |
| `top-bangla-writers-coverage/` | boi coverage analysis for top 100 |

## rescraped jun 11 2026 (completed)

All 4 sites rescraped in one pass via `dataset:import:public` with higher limits:

| site | limit used | archive raw (before → after) |
|------|-----------|------------------------------|
| wikidata | WIKIDATA_LIMIT=10000 | 2,000 → 10,000 |
| openlibrary | OPENLIBRARY_LIMIT=5000 | 3,731 → 4,346 |
| internet-archive | IA_LIMIT=3000 | 4,702 → 2,640† |
| books.com.bd | BOOKS_COM_BD_LIST_PAGE_LIMIT=100 | ~950 → 29,326 |

† IA count dropped because quality filter (must have creator + title) is stricter in this import path.

---

### raw source records stats (main dataset)

| table | count |
|-------|-------|
| source records | 508,434 |
| unique source names | 280+ |
| works | 340,585 |
| editions | 351,197 |
| authors | 120,653 |
| contributions | 408,576 |
