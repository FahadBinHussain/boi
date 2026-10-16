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
- ESLint (`pnpm lint` -> `eslint .`):
  - Next 16 removed `next lint`, and `eslint-config-next` 16 exports native flat-config arrays (`eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`). Import and spread them directly in `eslint.config.mjs` — do not wrap them with `FlatCompat` or keep a legacy `.eslintrc.json` alongside `eslint.config.mjs` (causes circular JSON structure crashes).
- Lockfile gotchas (`pnpm-lock.yaml`):
  - a pnpm major bump mostly rewrites metadata, not deps: `libc: [glibc]/[musl]`
    on linux platform binaries (sharp, `@next/swc`, `@unrs`), `deprecated:`
    notes, recomputed eslint peer hashes. Big diff, no real change.
  - a rewrite can still silently change a resolution (autoprefixer went
    10.5.0 -> 10.4.18 while `package.json` stayed `^10.4.18` with no
    overrides), so diff the `snapshots:` section for the real change.
  - validate before committing: `pnpm install --frozen-lockfile` (exit 0 =
    lock matches `package.json` + `node_modules`; ~100ms when clean).
  - commit the lock as-is when it matches what is installed; reverting it
    desyncs `node_modules` and the next install just rewrites it again.
- `dataset/main/` is gitignored (not present on Vercel/CI clones), so `scripts/sync-public-dataset.js` (run in `prebuild`) must warn and exit `0` when `dataset/main/generated/exports` is absent; exiting `1` breaks every Vercel build before `/dataset` can render its loud `DatasetExportError` banner.
- UI icon motion (Rule 10): all UI icons are wrapped with `@/components/ui/MotionIcon` (`bounce`, `spin`, `pulse`, `wiggle`, `float`, `hover`), which supports hover and persistent (`always`) motions. Never leave bare static icons in navigation, cards, tables, filters, or admin pages.
- DaisyUI & Theme System:
  - DaisyUI 4 (`daisyui: { themes: true }`) is configured in `tailwind.config.ts`, enabling all 32 official themes (`light`, `dark`, `cupcake`, `bumblebee`, `emerald`, `corporate`, `synthwave`, `retro`, `cyberpunk`, `valentine`, `halloween`, `garden`, `forest`, `aqua`, `lofi`, `pastel`, `fantasy`, `wireframe`, `black`, `luxury`, `dracula`, `cmyk`, `autumn`, `business`, `acid`, `lemonade`, `night`, `coffee`, `winter`, `dim`, `nord`, `sunset`).
  - `@tailwindcss/forms` uses `{ strategy: 'class' }` to prevent form resets from overriding DaisyUI `input`, `select`, `textarea`, `checkbox`.
  - All styling across pages and components relies strictly on DaisyUI semantic classes (`bg-base-100`, `bg-base-200`, `bg-base-300`, `text-base-content`, `card`, `btn`, `badge`, `table`, etc.) rather than hardcoded palette colors (`bg-gray-*`, `text-indigo-*`, `bg-[#...]`).
  - Active theme is persisted via `localStorage` and set on `document.documentElement` (`data-theme="<name>"`), with an anti-flash script in `src/app/layout.tsx`.
  - Theme picker in `src/components/theme/ThemeToggle.tsx` presents live 4-color DaisyUI swatches for every theme.
- Navigation Marker: Next.js App Router client-side `<Link>` transitions do not trigger page reloads or update mount-only `useEffect` state. Dynamic active route markers must use `usePathname()` from `next/navigation` and Framer Motion's `layoutId` (e.g. `layoutId="navbar-active-marker"`) so the indicator persists and smoothly glides between tabs across routes.
- Stray demos: any standalone experiments/demos outside `src/` (such as `smooth scroll/`) should not be checked into the main repo.
- After dataset or app changes, run the relevant verification command before saying the work is done.
- For dataset research/import work, the normal finish flow is:
  - `pnpm dataset:apply:candidate-research`
  - `pnpm dataset:export`
  - `pnpm dataset:check`
- For raw Internet Archive research updates, also use the matching IA apply script when relevant:
  - `pnpm dataset:apply:ia-research`

## Dataset Restore (dataset/main is gitignored)

`dataset/main/` and `dataset/archive/` are gitignored, so a fresh clone, a CI clone, or a wiped machine has neither. Never rebuild them by hand — restore the backup archive.

- backup: `boi-dataset-backup.zip` (947,236,007 bytes, 8107 entries, one top-level `dataset/` dir), kept outside the repo; how to reach it lives in the private automation notes, not here.
- zip integrity: every entry CRC-checks clean; extracting `dataset/main` + `dataset/archive` alone yields 8006 files / ~5.10 GB (main 7254, archive 789).
- extract ONLY `dataset/main/` and `dataset/archive/` into the repo root. The archive also carries `dataset/manifest.json`, `README.md`, `schema.md`, `schema/`, `scripts/` from its own older snapshot; those already exist in git and are newer, so extracting them too silently rolls back tracked files.
- restore baseline (counts the restored snapshot reported): 508,434 source records, 120,653 authors, 340,585 works, 351,197 editions, 408,576 contributions.
- verify after restoring:
  - `dataset/main/generated/exports` exists — that is what `prebuild` syncs into `public/dataset-assets/exports`
  - `pnpm build` passes
  - `pnpm start`, then `http://127.0.0.1:3000/dataset` returns 200 with real rows and no `DatasetExportError`
  - `http://127.0.0.1:3000/dataset/exports/dataset-summary.json` returns the counts above

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
