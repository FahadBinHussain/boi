# Bangla Books Master Dataset

Goal: build a source-backed master dataset of Bangla authors and Bangla books across Bangladesh, India, diaspora publishing, older bibliographies, and open library catalogs.

## Layout

- `archive/` keeps source exports, scrapes, API dumps, downloaded files, and research evidence.
- `main/` keeps the actual maintained dataset.
- `main/generated/` keeps generated review/export files. Do not treat these as a separate dataset.
- `schema/` documents the record shapes.
- `scripts/` keeps import, cleanup, dedupe, validation, and export scripts.

## Format

Use JSONL for the canonical working dataset, not one huge JSON file.

JSONL is better here because each line is one record, it can scale to hundreds of thousands of books, it is easy to append safely, and it can be converted later into SQLite, CSV, Parquet, or a web API.

## Core Tables

- `main/authors.jsonl` - one person or organization per line.
- `main/works/` - paged JSONL table, one conceptual book/work per line.
- `main/editions/` - paged JSONL table, one published edition/version per line.
- `main/contributions/` - paged JSONL table, author/editor/translator relationships.
- `main/source_records/` - paged source references and archive/evidence pointers, with `manifest.json` listing the JSONL pages.
- `main/candidate_duplicate_reviews.jsonl` - reviewed candidate rows that are already represented in `main/`, or reviewed as outside the BOI catalog scope.

## References

This follows the same evidence habit as the file-hosts project:

- every source is a record in the paged `main/source_records/` JSONL table;
- every main record uses `source_refs` to point back to source record ids;
- generated candidates may keep inline `sources` arrays while we are still verifying them;
- generated exports include paged `main/generated/exports/references/` files, and book pages embed the references needed for that page so the UI can show where a claim came from without one huge JSON file.

Example main record:

```json
{"id":"author_rabindranath_tagore","name_bn":"Rabindranath Tagore","name_en":"Rabindranath Tagore","aliases":["Rabindranath Thakur"],"source_refs":["source_wikidata_q7241"],"confidence":0.9}
```

## Commands

Run from the boi repo root:

```bash
pnpm dataset:validate
pnpm dataset:export
pnpm dataset:check
pnpm dataset:import:public
```

## Rule

Never overwrite archive data. Every main record should point back to at least one source record.

## Current Import Pass

`pnpm dataset:import:public` imports a first real source-backed pass from:

- RokomariBG on Hugging Face
- Wikidata Bengali-language works
- Open Library Bengali search records
- Internet Archive Bengali text metadata
- Authors.com.bd homepage author links
- Books.com.bd homepage book cards

`pnpm dataset:scrape:bdebooks` archives BDeBooks catalog metadata from the public WordPress API and sitemap evidence. It records metadata only; it does not fetch BDeBooks `/dl/` paths or `dl.bdebooks.com` book-file URLs. Keep this source in archive/reconciliation first; only promote matched or reviewed rows into `main/`.

`pnpm dataset:reconcile:bdebooks` checks the latest BDeBooks archive run against `main/` and writes archive-side buckets for exact matches, likely duplicates, possible matches, local misses, and manual review. It is report-only and does not change `main/`.

`pnpm dataset:scrape:banglaboipdf` archives BanglaBoiPDF WordPress post metadata only. It parses visible title/author/page/category details and records counts for omitted MediaFire/Drive/PDF-style links, but does not fetch or store book-file URLs.

`pnpm dataset:reconcile:banglaboipdf` checks the latest BanglaBoiPDF archive against `main/` and writes archive-side duplicate/miss buckets. `pnpm dataset:research:banglaboipdf-rokomari` researches local misses against live Rokomari pages, and `pnpm dataset:apply:banglaboipdf-rokomari` promotes only verified Rokomari-supported rows while re-checking existing source and title+author matches.

`pnpm dataset:scrape:banglabooks-in` archives BanglaBooks.in WordPress sitemap/API metadata only. It parses visible title, Bangla caption title, contributor, page count, file-size, category, tag, and cover metadata, and records counts/hostnames for omitted MediaFire/Google Drive style links without fetching or storing the book-file URLs.

`pnpm dataset:reconcile:banglabooks-in` checks the latest BanglaBooks.in archive against `main/` and writes archive-side duplicate/miss buckets. Treat not-found rows as candidates for later external research, not as automatic imports.

`pnpm dataset:scrape:banglabook-org` archives BanglaBook.org sitemap/category/detail-page metadata only. Its robots file disallows query-string URLs, so the scraper does not use the WordPress API; it crawls clean category pagination, skips `/refer/` and external file hosts, and records only omitted download-link counts/hostnames.

`pnpm dataset:reconcile:banglabook-org` checks the latest BanglaBook.org archive against `main/` and writes archive-side duplicate/miss buckets. Treat not-found rows as candidates for later external research, not as automatic imports.

`pnpm dataset:scrape:allboi` archives Allboi `/books/` metadata from the public book sitemaps and visible book pages. It records title, author, genre, cover, pages, size, reading-time, and download-count metadata only; it does not fetch `/download-book/`, `/read-online/`, admin-ajax, or any book-file URLs.

`pnpm dataset:reconcile:allboi` checks the latest Allboi archive against `main/` and writes archive-side duplicate/miss buckets. Treat not-found rows as candidates for later external research, not as automatic imports.

`pnpm dataset:scrape:medium-retailers` archives metadata-only retailer evidence from Boibazar, eBoighar, Wafilife, and Baatighar. Boibazar is crawled through public category listings/AJAX pagination, eBoighar and Wafilife through public sitemaps plus structured detail pages, and Baatighar through public shop listing cards because its sitemap currently returns server errors. The scraper refuses file, cart, checkout, account, and unexpected-host endpoints.

`pnpm dataset:research:medium-retailer-candidates` checks the latest medium-retailer archive against generated candidates and writes source-backed support only for exact normalized title matches with matching contributor evidence, or exact-title rows where the candidate had only generic/missing author text.

`pnpm dataset:scrape:strong-retailers` archives metadata-only retailer evidence from PBS, Prothoma, Kitabghor, and BDBOOKS. Prothoma and Kitabghor are crawled through public product sitemaps plus detail pages, PBS through public category listing pages, and BDBOOKS through public category pages plus their product-list JSON endpoint. The scraper refuses file, cart, checkout, account, and unexpected-host endpoints.

`pnpm dataset:research:strong-retailer-candidates` checks the latest strong-retailer archive against generated candidates and writes source-backed support only for exact normalized title matches with matching contributor evidence, or exact-title rows where the candidate had only generic/missing author text.

`pnpm dataset:scrape:granthagara` archives metadata-only Granthagara evidence from the public `boi` sitemaps and book detail pages. It records visible title, author, category, page/size, cover, and Archive.org item reference metadata only; it does not fetch PDF/download/stream/file URLs.

`pnpm dataset:research:granthagara-candidates` checks the latest Granthagara archive against generated candidates and writes source-backed support only for exact normalized title matches with matching contributor evidence, or exact-title rows where the candidate had only generic/missing author text.

`pnpm dataset:scrape:wikimedia-bengali-scans` archives metadata-only Bengali Wikisource Index namespace records plus linked Wikimedia Commons file-page metadata through the Wikimedia APIs. It records scan index title/contributor/year fields, Commons page metadata, page counts, and license labels only; it does not request direct file URLs or download scan files.

`pnpm dataset:research:wikimedia-bengali-scans-candidates` checks the latest Wikimedia Bengali scan archive against generated candidates and writes source-backed support only for exact normalized title matches with matching contributor evidence, or exact-title rows where the candidate had only generic/missing author text.

`pnpm dataset:scrape:rokomari-live` archives Rokomari's public sitemap inventory and candidate-like public `/book/` detail pages. It intentionally does not use `/search`, because Rokomari's robots file disallows search paths; the scraper refuses non-sitemap, non-book, file, cart, account, and unexpected-host endpoints.

`pnpm dataset:research:rokomari-live-candidates` checks the latest Rokomari live archive against generated candidates and writes source-backed support only when the sitemap-matched live book page confirms both title and author.

Use `RESET_DATASET_MAIN=1 pnpm dataset:import:public` only when rebuilding the generated baseline from scratch. Normal runs merge new records into the existing main JSONL files.

`pnpm dataset:candidates` writes the normal main-derived candidate queue to `main/generated/candidates/books.jsonl` and writes scrape-derived archive candidates to sharded files under `main/generated/candidates/archive/`, with counts in `main/generated/candidates/archive-manifest.json`.

Reviewed duplicates go in `main/candidate_duplicate_reviews.jsonl` with `status: "duplicate_of_main"`. Reviewed out-of-scope generated candidates can use statuses such as `not_book`, `not_bangla_book`, or `outside_scope` so `pnpm dataset:candidates` removes them from the queue without adding them to `main/`. `pnpm dataset:merge:main-duplicates-by-author -- --author "<name>" --candidate-overlap-only --apply` can collapse exact same-title/same-author main work rows when the same active archive candidate points at multiple main works. `pnpm dataset:review:archive-duplicates-by-author -- --author "<name>" --apply` adds exact archive-candidate duplicate reviews for that author. `pnpm dataset:apply:candidate-duplicate-references` turns the duplicate candidate's direct site links into paged `main/source_records/` references on the matched main work, and `pnpm dataset:candidates` suppresses those candidate ids while keeping the review evidence in version control.
