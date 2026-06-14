const fs = require("node:fs");
const path = require("node:path");
const { archiveDir, generated } = require("./paths");

const sourceSlug = "rokomari-live";
const requestedRunId = process.env.ROKOMARI_LIVE_RUN_ID || null;
const researchFileName = process.env.ROKOMARI_LIVE_RESEARCH_FILE || "candidate_rokomari_live_2026_06_03.json";

const genericAuthorPattern =
  /^(?:anonymous|author|creator|darulilm|fatwaa|fatwa|unknown|not available|rasikulindia|allboi|muster a)$/i;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(filePath, rows) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8211;|&#8212;|–|—/g, "-")
    .replace(/&#8216;|&#8217;|[‘’]/g, "'")
    .replace(/&#8220;|&#8221;|[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function hasBangla(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function key(value) {
  return cleanText(value)
    ?.toLowerCase()
    .normalize("NFKC")
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const stopWords = new Set(["a", "an", "and", "book", "books", "by", "pdf", "the", "o", "er"]);

function tokens(value) {
  const normalized = key(value);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return (2 * overlap) / (a.size + b.size);
}

function containsScore(a, b) {
  const left = key(a);
  const right = key(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftCount = left.split(/\s+/).filter(Boolean).length;
  const rightCount = right.split(/\s+/).filter(Boolean).length;
  const coverage = Math.min(leftCount, rightCount) / Math.max(leftCount, rightCount);
  if (coverage < 0.75) return 0;
  if (left.length >= 6 && right.includes(left)) return 0.92;
  if (right.length >= 6 && left.includes(right)) return 0.92;
  return 0;
}

function similarity(a, b) {
  if (!a || !b) return 0;
  return Math.max(containsScore(a, b), dice(new Set(tokens(a)), new Set(tokens(b))));
}

function authorSimilarity(a, b) {
  if (!a || !b) return 0;
  const left = tokens(a);
  const right = new Set(tokens(b));
  if (!left.length || !right.size) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  const coverage = overlap / left.length;
  return Math.max(similarity(a, b), coverage >= 0.8 ? 0.96 : coverage >= 0.6 ? 0.78 : 0);
}

function latestRunDir() {
  const root = path.join(archiveDir, sourceSlug);
  if (!fs.existsSync(root)) throw new Error(`No ${sourceSlug} archive directory found: ${root}`);
  const runs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, "manifest.json")))
    .map((entry) => ({
      name: entry.name,
      dir: path.join(root, entry.name),
      mtime: fs.statSync(path.join(root, entry.name, "manifest.json")).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!runs.length) throw new Error(`No ${sourceSlug} run found in ${root}`);
  return runs[0];
}

function selectedRun() {
  if (!requestedRunId) return latestRunDir();
  const dir = path.join(archiveDir, sourceSlug, requestedRunId);
  if (!fs.existsSync(path.join(dir, "manifest.json"))) throw new Error(`Rokomari live run has no manifest: ${dir}`);
  return { name: requestedRunId, dir };
}

function candidateAuthors(candidate) {
  return (candidate.authors || [])
    .map((author) => cleanText(author.name_bn || author.name_en))
    .filter(Boolean)
    .filter((author) => !genericAuthorPattern.test(author));
}

function splitAuthorEntry(author) {
  const nameBn = cleanText(author.name_bn);
  if (!nameBn || !nameBn.includes(",")) return [author];
  const parts = nameBn.split(/\s*,\s*/).map(cleanText).filter((part) => part && hasBangla(part));
  if (parts.length <= 1) return [author];
  return parts.map((part) => ({ ...author, name_bn: part, name_en: null }));
}

function uniqueAuthors(authors) {
  const seen = new Set();
  return authors.filter((author) => {
    const identity = `${key(author.name_bn || author.name_en)}|${author.role || "author"}`;
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function loadQueue() {
  return readJsonl(generated.candidateBooks)
    .filter((candidate) => hasBangla(candidate.title_bn || candidate.title_en))
    .filter((candidate) => (candidate.reason || "").includes("Internet Archive is the only source reference"))
    .filter((candidate) => candidateAuthors(candidate).length > 0);
}

function scoreProduct(candidate, product) {
  const title = candidate.title_bn || candidate.title_en;
  const authors = candidateAuthors(candidate);
  const titleCandidates = [product.title, product.title_en, product.page_title, product.slug].filter(Boolean);
  const authorCandidates = [product.author_bn, product.author_en, ...(product.contributors || []).map((contributor) => contributor.name)].filter(Boolean);
  const titleScore = Math.max(...titleCandidates.map((value) => similarity(title, value)), 0);
  const authorScore = Math.max(
    ...authors.flatMap((author) => authorCandidates.map((value) => authorSimilarity(author, value))),
    0
  );
  return {
    title_score: Math.round(titleScore * 1000) / 1000,
    author_score: Math.round(authorScore * 1000) / 1000,
    total_score: Math.round((titleScore * 0.7 + authorScore * 0.3) * 1000) / 1000
  };
}

function isAccepted(candidate, product, scores) {
  if (!product.title || !hasBangla(product.title)) return false;
  const author = product.author_bn || product.contributors?.[0]?.name;
  if (!author || !hasBangla(author)) return false;
  if (!candidateAuthors(candidate).length) return false;
  return scores.title_score >= 0.9 && scores.author_score >= 0.65;
}

function productsForCandidate(products, candidate) {
  return products
    .filter((product) => (product.candidate_matches || []).some((match) => match.work_id === candidate.normalized_work_id))
    .map((product) => ({
      product,
      scores: scoreProduct(candidate, product)
    }))
    .sort((a, b) => b.scores.total_score - a.scores.total_score);
}

function supportedItem(candidate, product, scores, run) {
  const productAuthorBn = cleanText(product.author_bn || product.contributors?.[0]?.name);
  const sourceAuthors = uniqueAuthors(
    candidate.authors
      .map((author) => {
        const candidateNameBn = cleanText(author.name_bn);
        const shouldPreferProductAuthor =
          productAuthorBn && hasBangla(productAuthorBn) && (!candidateNameBn || !hasBangla(candidateNameBn));
        return {
          name_bn: shouldPreferProductAuthor ? productAuthorBn : hasBangla(candidateNameBn) ? candidateNameBn : productAuthorBn,
          name_en: author.name_en || null,
          role: author.role || "author"
        };
      })
      .flatMap(splitAuthorEntry)
  );

  return {
    status: "supported_book",
    work_id: candidate.normalized_work_id,
    title_bn: product.title || candidate.title_bn,
    title_en: product.title_en || candidate.title_en || null,
    publication_year: candidate.first_published_year || product.publication_year || null,
    authors: sourceAuthors,
    edition: {
      title_as_printed: product.title || candidate.title_bn || candidate.title_en,
      publisher: product.publisher || null,
      publication_year: product.publication_year || candidate.first_published_year || null,
      isbn: product.isbn || null,
      pages: product.pages || null,
      format: "book"
    },
    evidence: `Rokomari public sitemap and live book page verify ${candidate.title_bn || candidate.title_en} with matching title and author metadata.`,
    evidence_sources: [
      {
        label: "Rokomari book page",
        url: product.url,
        notes: `Lists title ${product.title || product.title_en}, author ${product.author_bn || product.author_en}, publisher ${product.publisher || "unknown"}, and language ${product.language || "not parsed"}.`
      }
    ],
    best_match: { product, scores, accepted: true },
    sources: [
      {
        source: "Rokomari live book page",
        url: product.url,
        external_id: product.product_id,
        record_type: "book",
        raw_title: product.title || product.title_en || candidate.title_bn || candidate.title_en,
        raw_author: product.author_bn || product.author_en || candidateAuthors(candidate).join(", "),
        raw_path: `archive/${sourceSlug}/${run.name}/books.jsonl`,
        notes: "Current public Rokomari sitemap and book page confirm the candidate title and author."
      }
    ]
  };
}

function reviewItem(candidate, matches) {
  const best = matches[0] || null;
  return {
    status: "needs_manual_review",
    work_id: candidate.normalized_work_id,
    title_bn: candidate.title_bn || null,
    title_en: candidate.title_en || null,
    evidence: best
      ? `Rokomari sitemap candidate page did not pass title+author thresholds for ${candidate.title_bn || candidate.title_en}.`
      : `Rokomari sitemap slug scan found no candidate detail page for ${candidate.title_bn || candidate.title_en}.`,
    best_match: best ? { ...best, accepted: false } : null
  };
}

function main() {
  const run = selectedRun();
  const products = readJsonl(path.join(run.dir, "books.jsonl"));
  const candidates = loadQueue();
  const items = [];

  for (const candidate of candidates) {
    const matches = productsForCandidate(products, candidate);
    const accepted = matches.find((match) => isAccepted(candidate, match.product, match.scores));
    items.push(accepted ? supportedItem(candidate, accepted.product, accepted.scores, run) : reviewItem(candidate, matches));
  }

  const counts = {};
  for (const item of items) counts[item.status] = (counts[item.status] || 0) + 1;
  const supportedItems = items.filter((item) => item.status === "supported_book");
  const reviewItems = items.filter((item) => item.status !== "supported_book");
  writeJsonl(path.join(run.dir, "candidate-review.jsonl"), reviewItems);

  const outPath = path.join(archiveDir, "candidate_source_research", researchFileName);
  writeJson(outPath, {
    generated_at: new Date().toISOString().slice(0, 10),
    research_scope:
      "Rokomari live candidate pass using the public sitemap inventory plus public /book/ detail pages. /search is intentionally not used because robots.txt disallows it. Only verified title+author matches are promoted from this file; rejects are kept in the run archive candidate-review.jsonl.",
    selection_summary: {
      run_id: run.name,
      checked_candidates: candidates.length,
      source_records: products.length,
      promoted_items: supportedItems.length,
      review_items: reviewItems.length,
      ...counts
    },
    items: supportedItems
  });

  console.log(
    JSON.stringify(
      {
        run_id: run.name,
        output: path.relative(archiveDir, outPath).replaceAll("\\", "/"),
        checked_candidates: candidates.length,
        source_records: products.length,
        promoted_items: supportedItems.length,
        review_items: reviewItems.length,
        ...counts
      },
      null,
      2
    )
  );
}

main();
