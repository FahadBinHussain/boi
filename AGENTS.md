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
- `dataset/main/` is gitignored (not present on Vercel/CI clones). Nothing under it is copied into `public/` anymore — `/dataset` and `/dataset/exports/*` read the Turso database, so a clone without `dataset/main` still renders the full dataset (see "Dataset Live Database (Turso)"). Never make a build step depend on `dataset/main` existing.
- UI icon motion (Rule 10): all UI icons are wrapped with `@/components/ui/MotionIcon` (`bounce`, `spin`, `pulse`, `wiggle`, `float`, `hover`), which supports hover and persistent (`always`) motions. Never leave bare static icons in navigation, cards, tables, filters, or admin pages.
- DaisyUI & Theme System:
  - DaisyUI 4 (`daisyui: { themes: true }`) is configured in `tailwind.config.ts`, enabling all 32 official themes (`light`, `dark`, `cupcake`, `bumblebee`, `emerald`, `corporate`, `synthwave`, `retro`, `cyberpunk`, `valentine`, `halloween`, `garden`, `forest`, `aqua`, `lofi`, `pastel`, `fantasy`, `wireframe`, `black`, `luxury`, `dracula`, `cmyk`, `autumn`, `business`, `acid`, `lemonade`, `night`, `coffee`, `winter`, `dim`, `nord`, `sunset`).
  - `@tailwindcss/forms` uses `{ strategy: 'class' }` to prevent form resets from overriding DaisyUI `input`, `select`, `textarea`, `checkbox`.
  - All styling across pages and components relies strictly on DaisyUI semantic classes (`bg-base-100`, `bg-base-200`, `bg-base-300`, `text-base-content`, `card`, `btn`, `badge`, `table`, etc.) rather than hardcoded palette colors (`bg-gray-*`, `text-indigo-*`, `bg-[#...]`).
  - Active theme is persisted via `localStorage` and set on `document.documentElement` (`data-theme="<name>"`), with an anti-flash script in `src/app/layout.tsx`.
  - Theme picker in `src/components/theme/ThemeToggle.tsx` presents live 4-color DaisyUI swatches for every theme.
  - **`.menu` + a height cap wraps into COLUMNS instead of scrolling (hit 2026-10-16).** DaisyUI 4.12 ships `.menu { flex-direction: column; flex-wrap: wrap }`, so a `.menu` with `max-h-*` + `overflow-y-auto` wraps its items into extra columns once it hits the cap — and because `overflow-y` set alone computes `overflow-x` to `auto`, you get a horizontal scrollbar and clipped side-columns instead of a scrolling list. The theme picker rendered its 32 themes as two clipped columns until `flex-nowrap overflow-x-hidden` was added to the `ul`. Any future long `menu` with a height cap needs `flex-nowrap` (Tailwind utilities layer wins over DaisyUI's components layer); prove it in the build by checking `.flex-nowrap{flex-wrap:nowrap}` appears AFTER `.menu{...flex-wrap:wrap}` in `.next/static/css/*.css`.
- Navigation Marker: Next.js App Router client-side `<Link>` transitions do not trigger page reloads or update mount-only `useEffect` state. Dynamic active route markers must use `usePathname()` from `next/navigation` and Framer Motion's `layoutId` (e.g. `layoutId="navbar-active-marker"`) so the indicator persists and smoothly glides between tabs across routes.
- Stray demos: any standalone experiments/demos outside `src/` (such as `smooth scroll/`) should not be checked into the main repo.
- After dataset or app changes, run the relevant verification command before saying the work is done.
- For dataset research/import work, the normal finish flow is:
  - `pnpm dataset:apply:candidate-research`
  - `pnpm dataset:export`
  - `pnpm dataset:check`
- For raw Internet Archive research updates, also use the matching IA apply script when relevant:
  - `pnpm dataset:apply:ia-research`

## Frontend Layout Conventions

- **A CSS variable without a fallback invalidates the whole declaration.** `font-family: var(--font-inter), sans-serif` with `--font-inter` undefined does not fall back to `sans-serif` — it falls back to the *initial* value, so the whole site silently rendered in Times New Roman until `next/font` was wired up. Always write `var(--font-inter, ui-sans-serif)`. The fonts now come from `next/font/google` in `src/app/layout.tsx` (`--font-inter` = Inter for Latin, `--font-bengali` = Hind Siliguri for Bengali, which Inter has no glyphs for), and `tailwind.config.ts` maps both into `fontFamily.sans`.
- **One layout shell for every page.** `.shell` in `src/app/globals.css` owns the max-width (1480px) and the gutter step (24px / 48px at `lg`). The header, footer and every page use it, so their edges line up. Do not reintroduce `container mx-auto px-4 sm:px-6 lg:px-8` or a bespoke `max-w-[1480px]` — those two widths disagree with each other and break alignment.
- **Grid tracks that hold text need `minmax(0, 1fr)`.** `grid-cols-[1.1fr_0.9fr]` overflows on long Bengali titles; write `grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]`. Grid/flex children that hold long text also need `min-w-0`.
- **Never chain a GSAP timeline over a live `HTMLCollection`.** The desktop nav in `Header.tsx` is `display:none` below `md`, and a tween chain built from `ref.current.children` stalled there, leaving the mobile search/menu buttons at `opacity: 0` and pushed off-screen (they were invisible and untappable on every phone). Flatten to a plain array and use ONE tween over all targets, with `clearProps` so the natural CSS state is restored. Keep `prefers-reduced-motion` as an early return.
- **The sticky header needs `scroll-padding-block-start`** (set to `5rem` on `html`), otherwise anchored or focus-scrolled targets land underneath it.
- **A hover-only overlay is unreachable on touch.** `BookCard`'s cover actions open on hover, keyboard focus, or always on `(hover: none)` devices.
- **Never gate content visibility on an animation that needs a frame.** Framer Motion runs on `requestAnimationFrame`, which browsers throttle to nothing in a background tab, so an element with `initial={{ opacity: 0 }}` stays invisible — the whole landing hero and the book grids did exactly this. Use `useEntranceAnimation` (`src/hooks/useEntranceAnimation.ts`): it renders the element visible first and only plays the entrance once the frame clock is running, and it honours `prefers-reduced-motion`. Mount-time entrances (`animate=`, not `whileInView=`) need it; `whileInView` self-heals on scroll.
- **Tailwind's `text-7xl`/`text-5xl` ship line-height 1.0, and `leading-*` loses to them.** Use the font-size/line-height modifier instead: `text-7xl/[1.1]`, `text-3xl/[1.2]`. A separate `leading-tight` class is silently overridden.
- **Type floor: nothing below 12px.** `text-[10px]`/`text-[11px]` are gone; the smallest UI text is `text-xs` (12px).
- **Bengali catalogue strings need `<bdi>`.** The document is `lang="en"` and the catalogue is Bengali, so dynamic titles, authors and genre names go inside `<bdi>` and the static `বই` wordmark carries `lang="bn"`.
- **Rendered text uses the real ellipsis character `…`,** never three dots.
- Local dev needs a Postgres for the `/api/books` catalog path (`prisma db push`), and the seeded catalog can be filled from the live Turso `works`/`editions`/`authors` tables so layouts are verified against real Bengali titles. The vault `.env.local` only carries the Turso variables; `DATABASE_URL` and the NextAuth/Google vars are local-only additions.
- **On Windows, run that local Postgres as a Windows service.** Started from a shell (`pg_ctl start`), its client backends die intermittently with `0xC0000142` (STATUS_DLL_INIT_FAILED) and the log shows `could not reserve shared memory region ... error code 487`; simple queries work, then the next backend dies and takes the server with it. Register it instead — `pg_ctl register -N boipg -D <datadir> -o "-p 5434" -S auto` then `Start-Service boipg` — and the service environment keeps it stable. Never `taskkill` the postmaster: that leaves the Windows shared-memory block behind and every later start on that port fails with `pre-existing shared memory block is still in use`; stop it with `pg_ctl stop -m fast`. The Prisma table is `"Book"` (capital B, no `@@map`), so ad-hoc SQL must quote it.

## Frontend Color Conventions

- **Muted text alpha floor is `/75`.** Measured against the live DaisyUI `light` and `dark` themes: `text-base-content/70` clears 4.5:1 in light but drops to 4.18:1 in dark, because the dark `base-200` card surface sits close to the dark theme's `base-content`. `/75` is the lightest alpha that clears 4.5:1 on `base-100`/`base-200`/`base-300` in BOTH themes — use it for every secondary label.
- **Put the hue on the background, not on the label.** A `bg-primary/10` chip with a `text-primary` glyph measures 2.89:1, and `text-accent` on `bg-accent/10` only 1.70:1. Keep the tinted chip background and set the glyph to `text-base-content` (11-12:1 in light, 6.1-6.4:1 in dark). Same rule for the `live database` status pill on `/dataset`.
- **The headline gradient must not include the `accent` stop.** `oklch(var(--a))` on white is 1.83:1 and fails even the 3:1 large-text bar. The headline runs `from-primary to-secondary` — 7.68:1 / 3.39:1 in light, 4.73:1 / 5.63:1 in dark.
- **`btn-disabled` already dims itself to `--tw-text-opacity: 0.2`.** Do not stack `opacity-40` on top of it; that is 8% effective and the label disappears. WCAG 1.4.3 exempts inactive controls, so DaisyUI's own disabled treatment is the intended look.
- **Measuring contrast in a real browser has two traps.** (1) Chrome serializes achromatic DaisyUI colors as `oklab(L 0 0)`, so an `oklch`-only parser silently drops the page background and reports false passes — parse `oklab()` too. (2) CSS transitions are paused in a backgrounded tab, so reading `getComputedStyle` right after flipping `data-theme` returns the OLD theme's colors; disable transitions before switching. Composite the whole ancestor chain (outermost opaque layer inward) instead of compositing a translucent layer over white.

## Frontend Writing Conventions

- **One name per thing.** The detail action is `View details` everywhere (book card overlay, featured card, genre/author/series cards). The catalog entry point is `Browse books`. The admin add action is `Add new book`. Do not introduce a synonym for an action that already has a label.
- **Sentence case for headings, buttons and links.** `Add new book` sits next to `Browse books`; `Browse books` sits next to `Explore genres`. Never mix `Save Changes` with `Discard changes`.
- **An error names what failed and then the fix, in that order.** The alert heading carries the failure (`Unable to load books`) and the line under it carries the fix (`Check your connection and try again.`). No `Oops`, no `Something went wrong`, and never an error with no recovery step.
- **Cut `successfully`.** `Book added`, `Settings saved`, `3 books deleted` — the toast already sits in the success slot.
- **Cut `Please` from a routine instruction.** `Enter a book name`, `Fill in the highlighted fields`, `Select a PDF file for the book`.
- **Counts go through `Intl`.** `pluralBooks()` in `src/app/admin/books/page.tsx` picks the plural form. Never `book(s)`.
- **Destructive confirmations name the action and the object.** `Delete "Title"? This cannot be undone.` — never `Are you sure…`. Dialog buttons are verb plus object, never `Yes`/`No`/`OK`.
- **Empty states orient and point forward.** The title names the empty thing (`No books match your search`) and the line under it names the way out (`Try a different title or author.`). Admin empty states keep the add action next to them.
- **Icon-only controls name the action.** The admin row buttons are `Edit book` and `Delete book`, not `Edit`/`Delete`.
- **Placeholders show an example, not an instruction.** `e.g. Penguin`, `e.g. 320`. When a field carries a real requirement (like leaving an API key unchanged), the requirement belongs in helper text.

## Frontend Motion Conventions

- **One `MotionConfig` gates every animation.** `src/app/providers.tsx` wraps the app in `<MotionConfig reducedMotion="user">`, so every transform animation (MotionIcon, `whileHover`, `whileTap`, the scroll entrances) falls back to an opacity cross-fade when the reader asked for less motion. Never add a transform animation outside that provider.
- **A press is a transition, not a keyframe.** DaisyUI's `button-pop` keyframe plays on every button at mount and cannot be reversed mid-press, so `src/app/globals.css` replaces it: the button settles to `0.96` over `150ms ease-out` and comes back if the press is released early. `whileTap` scales are `0.96` too — `0.95` is below the floor.
- **Name the properties a transition changes.** `transition-all` is gone. Use `transition-colors` for colour changes and `transition-[box-shadow]` for elevation. An element animated by Framer Motion must not also carry a CSS `transform` transition — the two fight each other.
- **Hover only on hover-capable pointers.** `tailwind.config.ts` sets `future.hoverOnlyWhenSupported`, so every `hover:` variant compiles under `@media (hover: hover) and (pointer: fine)` and a tapped button does not keep its hover styling.
- **The theme switch must not animate.** `applyTheme()` in `src/contexts/ThemeContext.tsx` disables transitions, flips `data-theme`, flushes the style and restores transitions on the next frame; otherwise every colour transition on the page fires at once and the swap smears.
- **Content images get a 1px outline inset by 1px** — `outline outline-[1px] outline-black/10 dark:outline-white/10 -outline-offset-[1px]`. Pure black in light and pure white in dark, never a tinted neutral, so the edge does not read as a colour fringe.
- **Scrollable overlays contain their scroll.** The theme menu, the admin sidebar and the dataset table carry `overscroll-contain`, so scrolling past the end never scrolls the page behind.
- Dead CSS is removed, not kept: `.gpu-accelerated`, `.reveal-text`, `.parallax-*`, `.stagger-container`, `.feature-box`, `.hero-gradient` and `.page-transition-overlay` were all unused and are gone.

## Frontend Accessibility Conventions

- **Native elements first.** `<button>` for actions, `<a href>` for navigation, never `<div onClick>`. A pointer-only control is a keyboard dead end (WCAG 2.1.1) and is the defect this section exists to prevent.
- **A sortable column header is a `<button>` inside a `<th scope="col">`,** not a `<th>` with an `onClick`. The admin books and users tables both used to sort on `<th onClick>`, which no keyboard could reach. `src/components/ui/SortableTableHeader.tsx` renders the button and puts `aria-sort` (`none` / `ascending` / `descending`) on the `<th>`; the arrow glyph is `aria-hidden` because `aria-sort` already carries the state. Use that component for every sortable column instead of writing the markup again.
- **Every control has an accessible name.** Icon-only buttons carry `aria-label` (`Edit book`, `Dismiss notification`), inputs and selects that have no visible `<label>` carry `aria-label`, and a visible label is bound with `htmlFor`/`id`. A placeholder is not a label.
- **The skip link is the first focusable element** (`<a href="#main-content" className="skip-link">` in `src/app/layout.tsx`, styled in `src/app/globals.css`). It is off-screen until focused, then fixed at 1rem with the DaisyUI primary colours. The target `<main id="main-content" tabIndex={-1}>` keeps the browser's own focus ring — do not add `focus:outline-none` to it.
- **A client-side route change moves focus and announces the new page.** `src/components/layout/RouteAnnouncer.tsx` focuses `#main-content` and writes the new `<h1>` into a `role="status" aria-live="polite"` region that is rendered empty from the start, so the live region is registered before its first update.
- **Escape closes every overlay and returns focus to the control that opened it.** `src/hooks/useDismissable.ts` handles the key, the outside pointerdown and the focus restore. Use it for any dropdown, drawer or menu; do not write a second Escape handler.
- **A DaisyUI dropdown cannot be escaped.** DaisyUI opens `.dropdown-content` on `:focus-within`, so a keyboard user cannot close it — focusing anything inside keeps it open. The theme menu is React-controlled instead (`dropdown-controlled` + `dropdown-open` in `globals.css`, `aria-expanded` + `aria-controls` on the trigger). Any dropdown that must be escapable needs the same treatment.
- **A `justify-between` row with a long heading overflows at 320px.** The landing page's "Featured reading picks" row and the author/genre/series headers put a heading next to a button in a non-wrapping flex row; at 320 CSS px the row is wider than the 262px content box, so the page scrolls sideways (WCAG 1.4.10). Stack them: `flex flex-col sm:flex-row sm:items-center justify-between gap-4`, put `min-w-0` on the heading, and `flex-wrap` on a control group that holds a select and a button.
- **Measuring reflow needs the document, not the elements.** Compare `document.documentElement.scrollWidth` with `clientWidth` at a 320px viewport (`Emulation.setDeviceMetricsOverride`). An element scan that looks for a box past the viewport edge finds nothing here, because the overflow is a flex row whose *content* is wider than the row, not a box that sticks out. To name the offender, bisect: hide one subtree at a time with `display: none` and watch `scrollWidth` drop.
- **The off-canvas admin drawer must follow the same breakpoint as its CSS.** The drawer is off-screen below `md` and a docked rail above it, so the `inert` attribute has to be driven by the same media query (`src/hooks/useMediaQuery.ts`), not by the open/closed state alone. While the drawer is open the content behind it is `inert`, focus moves into the drawer, and Escape closes it and returns focus to the toggle.
- **An error toast stays until it is dismissed.** The default toast disappears after four seconds, which is long enough for a sighted user to read it and short enough that a screen reader user never hears it. Error toasts render `src/components/ui/ErrorToast.tsx` (with a dismiss button) and the `<Toaster>` gives the `error` type `duration: Infinity` — `setTimeout` clamps that to ~24 days, so it never auto-dismisses.
- **Decorative icons are hidden by default.** `src/components/ui/MotionIcon.tsx` sets `aria-hidden="true"` unless an explicit `aria-label` is passed, so an icon inside a labelled button is not announced a second time.
- **Every route carries its own title and canonical URL.** Page metadata lives in a route-segment `layout.tsx` (`src/lib/seo.ts` -> `pageMetadata()`); a segment layout still needs a default export even when it only carries metadata. A dynamic title comes from `generateMetadata` (`src/app/books/[id]/layout.tsx` reads the book from Prisma, because the crawler never runs the client bundle). The admin area is `noindex`.
- **Local admin testing does not need Google OAuth.** The dev database uses NextAuth database sessions: create a `User` with `role = "ADMIN"` and a `Session` row, then set the `next-auth.session-token` cookie for `localhost` in the browser (`Network.setCookie`). The session table is local-only and never touches the deployed database.

## Dataset Restore (dataset/main is gitignored)

`dataset/main/` and `dataset/archive/` are gitignored, so a fresh clone, a CI clone, or a wiped machine has neither. Never rebuild them by hand — restore the backup archive.

- backup: `boi-dataset-backup.zip` (947,236,007 bytes, 8107 entries, one top-level `dataset/` dir), kept outside the repo; how to reach it lives in the private automation notes, not here.
- zip integrity: every entry CRC-checks clean; extracting `dataset/main` + `dataset/archive` alone yields 8006 files / ~5.10 GB (main 7254, archive 789).
- extract ONLY `dataset/main/` and `dataset/archive/` into the repo root. The archive also carries `dataset/manifest.json`, `README.md`, `schema.md`, `schema/`, `scripts/` from its own older snapshot; those already exist in git and are newer, so extracting them too silently rolls back tracked files.
- restore baseline (counts the restored snapshot reported): 508,434 source records, 120,653 authors, 340,585 works, 351,197 editions, 408,576 contributions.
- verify after restoring:
  - `dataset/main/generated/exports` exists (the source for `pnpm dataset:db:build`; the site itself reads the Turso database, not these files)
  - `pnpm build` passes
  - `pnpm start`, then `http://127.0.0.1:3000/dataset` returns 200 with real rows and no `DatasetExportError`
  - `http://127.0.0.1:3000/dataset/exports/dataset-summary.json` returns the counts above

## Dataset JSONL Storage Forms (flat vs paged)

The four big tables (`works`, `editions`, `contributions`, `source_records`) can exist in two forms under `dataset/main/`: a flat `<table>.jsonl`, or a paged `<table>/NNNN.jsonl` set with `<table>/manifest.json`. `dataset/scripts/jsonl-store.js` `readJsonl()` prefers the paged dir whenever page files exist, and its `writeJsonl()` for these paths writes pages + manifest and deletes the flat file.

Several older apply scripts (`apply-candidate-source-research.js`, `merge-duplicate-candidate-works.js`, `repair-rokomari-page-titles.js`) carry their own local `writeJsonl` that writes the flat file directly (hit 2026-10-16). On a paged dataset their edits land in a form the pipeline never reads, so `dataset:export`, `dataset:check`, and `dataset:db:build` keep the old data even though the apply reported success. After running one of those scripts on a paged dataset, re-materialize the pages before exporting — load each table from the flat file that was just written and call the store writer:

```js
const store = require("./dataset/scripts/jsonl-store.js");
const paths = require("./dataset/scripts/paths.js");
for (const key of ["sources", "works", "editions", "contributions"]) {
  const file = paths.tables[key];
  const rows = fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  store.writeJsonl(file, rows); // writes pages + manifest, removes the flat file
}
```

## Dataset Live Database (Turso)

`/dataset` and every `/dataset/exports/*` response are served live from the Turso
database — `dataset/main/` is NOT required at runtime. Rules:

- Free-tier guardrails (plan `starter`, overages off, so hitting a cap errors instead of billing):
  - 5 GB storage (db file is ~0.9 GB), 500M rows read, 10M rows written, 3 GB syncs per month.
  - one `/dataset` view is about 1,330 rows read, so the read quota is roughly 376k page views/month.
  - every page read is keyset: 1 `dataset_page_keys` read + 1 read per row. Never add offset/`LIMIT` scans or joins over `works`/`contributions` — the rank key columns exist for this.
  - region: group `boi-mumbai` (`aws-ap-south-1`, closest free region to Dhaka). The free plan allows exactly one group.
- Ordering contract lives in `dataset/scripts/dataset-db-schema.mjs` (`sortBookRows` mirrors the export comparator). SQLite binary collation cannot reproduce the export's ICU `localeCompare`, so rows store a precomputed RANK per (sort, direction) in `k_{title,author,year,editions}_{asc,desc}` and are always compared ASC. Never re-sort in SQL.
- Rare undeclared row fields ride in an `extras` JSON column and are merged back with the export file's exact field order.
- References grid pages (`references/pages/*.json`) are stored verbatim gzipped (~50 MB for 416 MB raw); regenerating them from normalized tables could not be byte-faithful. The route gunzips with `node:zlib`.
- Build + seed flow (scripts read `TURSO_*` from `.env.local`; tokens in the vault):
  - `pnpm dataset:db:build` -> `dataset/main/generated/db/boi-dataset.db` + `db-manifest.json`, and parity-checks against the export files (paged works/candidates samples, stored export files byte-identical, references pages byte-identical).
  - `pnpm dataset:db:provision` (destructive, needs `--yes`) -> deletes and recreates the database with `seed.type = "database_upload"`, then mints read-only + full-access tokens into `dataset/main/generated/db/token.json`. Platform token lives in the vault (`app.turso.tech`).
  - `pnpm dataset:db:upload` -> native `curl.exe --http1.1 -H "Expect:" --data-binary @file` with a manual Content-Length (node fetch/undici streaming dies with `write ECONNRESET`), then verifies counts/pages/stored files against the live DB. `--verify` skips the upload.
  - The upload endpoint is single-shot seeding: it only works while the DB has no file, and an aborted upload leaves a sticky `"Database upload already in progress"` lock that only delete+recreate clears. Never probe the endpoint first; run provision and upload in one shot.
- App data layer: `src/lib/dataset-db.ts` (`@libsql/client/web`). It fails loudly — quota exhaustion or a DB error renders the `DatasetExportError` panel; there is no fallback to disk exports.
- Env: `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (read-only token, the app never uploads) in `.env.local` locally and in the Vercel `boi` project (Production + Preview). The full-access token is only needed by `dataset:db:upload`.

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
