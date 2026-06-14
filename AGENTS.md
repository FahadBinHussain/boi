# AGENTS.md

## Project Context

BOI is a Bengali text/archive catalog. Do not treat it as only a normal authored-book database.

Keep the data model simple:
- archive/evidence layer: raw source captures and research notes
- main dataset layer: normalized authors, works, editions, contributions, and source records

Treat candidate files, exports, and public dataset assets as generated views of the main dataset, not separate places to maintain by hand.

Valid BOI archive records can include:
- books
- journals
- magazines
- proceedings
- other Bengali archive/text records when the evidence is concrete

When a record is not a normal book, preserve the material type in metadata, especially `edition.format` and source `record_type` (`book`, `journal`, `magazine`, `proceedings`, etc.).

## Tooling

- Prefer `pnpm` for project commands.
- After dataset or app changes, run the relevant verification command before saying the work is done.
- For dataset research/import work, the normal finish flow is:
  - `pnpm dataset:apply:candidate-research`
  - `pnpm dataset:export`
  - `pnpm dataset:check`
- For raw Internet Archive research updates, also use the matching IA apply script when relevant:
  - `pnpm dataset:apply:ia-research`

## Dataset Research Rules

Keep research simple and search-first.

For candidate rows, try to find the book with normal internet search using:
- exact Bengali title
- romanized/English title
- title plus author
- title plus publisher/year when available

Use source pages that clearly identify the same work, such as Rokomari, PBS, publisher pages, library catalogs, NDLI/DLI pages, Goodreads, Google Books/Play Books, Wikimedia/Commons scan pages, or other stable catalog/authority pages.

Archive.org-only support is not enough for a work. If internet search does not find a clear matching non-Archive source, leave the item as `needs_manual_review`.

For supported items:
- record the search/source URLs in `evidence_sources`
- include at least one non-Archive source in `sources`
- keep evidence concise and explain why the match is exact

## Duplicate And Ambiguous Records

Be stricter when two rows have the same or very similar title and author.

For duplicate-looking title/author pairs:
- do not rely on Archive.org metadata plus one weak catalog row
- check the cover, title page, OCR first pages, or PDF scan when available
- compare publisher, year, pages, edition, volume, issue number, and series title
- look for an extra independent reference if the distinction is still unclear
- keep the row as `needs_manual_review` if the evidence cannot clearly distinguish duplicate, edition, volume, or issue

Examples of ambiguity signals:
- same Bengali title with same author
- same romanized title with nearby years
- issue-only titles like Bengali calendar years
- records where the visible candidate title is just a year, issue number, or volume wrapper

## BOI Archive Scope

Do not mark journals, magazines, or proceedings as rejected just because they are not standalone authored books.

Use `supported_book` if the current pipeline needs that status to preserve the row, but keep the real material type in:
- `edition.format`
- `sources[].record_type`
- `evidence`

Use `not_book` only for records that are genuinely outside BOI scope, such as non-text junk, non-Bengali material, bad metadata that cannot be verified, or records that should not be cataloged.

## Candidate Research Batch Workflow

When researching the next candidate batch:
- read all JSON files under `dataset/raw/candidate_source_research/`
- collect already researched `work_id` values
- select the next current rows from `dataset/candidates/books.jsonl` whose `normalized_work_id` has not been researched
- search the internet for each candidate book using the best available title/author strings
- open the best matching public pages and compare title, author, publisher, year, pages, edition, or series details
- use Archive/DLI metadata only as supporting context or when internet search results are ambiguous
- write a new JSON batch under `dataset/raw/candidate_source_research/` as archive/evidence-layer input
- apply that evidence into the main normalized dataset with the candidate research script
- keep evidence concise but source-backed

## Data Safety

- Preserve existing dataset records unless the research evidence clearly supports a change.
- Do not overwrite unrelated local changes.
- Generated export diffs can be large because candidate pagination shifts; summarize the logical dataset change, not just diff size.
- Do not hand-edit candidate/export/public asset files except through the dataset generation scripts.
- Do not print or expose secrets, tokens, cookies, API keys, or private credentials.

## Final Response Expectations

After repo or dataset work, include:
- the files changed
- supported/manual/rejected counts
- material-type breakdown when relevant
- verification commands run
- short concrete commands the user can run to test the result
