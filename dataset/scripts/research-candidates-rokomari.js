const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { archiveDir, generated, tables } = require("./paths");
const { readJsonl } = require("./jsonl-store");

const researchId = process.env.CANDIDATE_ROKOMARI_RESEARCH_ID || new Date().toISOString().replace(/[:.]/g, "-");
const limit = Number(process.env.CANDIDATE_ROKOMARI_LIMIT || 100);
const offset = Number(process.env.CANDIDATE_ROKOMARI_OFFSET || 0);
const delayMs = Number(process.env.CANDIDATE_ROKOMARI_DELAY_MS || 500);
const maxCards = Number(process.env.CANDIDATE_ROKOMARI_MAX_CARDS || 5);

const genericAuthorPattern =
  /^(?:anonymous|author|creator|darulilm|fatwaa|fatwa|unknown|not available|rasikulindia|allboi|muster a)$/i;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

function hasBangla(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function hasLatin(value) {
  return /[A-Za-z]/.test(String(value || ""));
}

function key(value) {
  return cleanText(value)
    ?.toLowerCase()
    .normalize("NFKC")
    .replace(/&/g, " and ")
    .replace(/[''`]/g, "")
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
  const leftTokenCount = left.split(/\s+/).filter(Boolean).length;
  const rightTokenCount = right.split(/\s+/).filter(Boolean).length;
  const coverage = Math.min(leftTokenCount, rightTokenCount) / Math.max(leftTokenCount, rightTokenCount);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRokomariId(urlOrPath) {
  const match = String(urlOrPath || "").match(/\/book\/(\d+)(?:\/|$)/);
  return match ? match[1] : null;
}

function absoluteRokomariUrl(href) {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  return `https://www.rokomari.com${href.startsWith("/") ? "" : "/"}${href}`;
}

async function fetchText(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "bn,en-US;q=0.9,en;q=0.8",
          "cache-control": "no-cache"
        }
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(750 * attempt);
    }
  }
  throw lastError;
}

function searchUrl(query) {
  const url = new URL("https://www.rokomari.com/search");
  url.searchParams.set("term", query);
  return url.toString();
}

function parseSearchCards(html) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const cards = [];
  $(".product-card-wrapper").each((_, node) => {
    const href = $(node).find('a[href*="/book/"]').first().attr("href");
    const productId = parseRokomariId(href);
    if (!href || !productId || seen.has(productId)) return;
    seen.add(productId);
    cards.push({
      product_id: productId,
      url: absoluteRokomariUrl(href),
      title_bn: cleanText($(node).find(".book-title").first().text()),
      author_bn: cleanText($(node).find(".book-author").first().text())
    });
  });
  return cards;
}

function parseSpecTable($) {
  const specs = {};
  $(".details-book-additional-info table tr, .details-book-additional-info .table tr").each((_, row) => {
    const cells = $(row)
      .find("td,th")
      .map((__, cell) => cleanText($(cell).text()))
      .get()
      .filter(Boolean);
    if (cells.length >= 2) specs[cells[0].toLowerCase()] = cells.slice(1).join(" ");
  });
  return specs;
}

function parseYear(value) {
  const match = String(value || "").match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function parsePages(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function parseProduct(html, fallbackCard) {
  const $ = cheerio.load(html);
  const specs = parseSpecTable($);
  const authorLink = $(".details-book-main-info").first().find('a[href*="/book/author/"]').first();
  return {
    product_id: fallbackCard.product_id,
    url: fallbackCard.url,
    title_bn: cleanText(specs.title) || cleanText($("h1").first().text()) || fallbackCard.title_bn,
    title_en: cleanText($("#js--product-en-name").attr("value")),
    author_bn: cleanText(specs.author) || cleanText(authorLink.text()) || fallbackCard.author_bn,
    author_en: cleanText($("#js--product-author-name").attr("value")),
    publisher: cleanText(specs.publisher),
    isbn: cleanText(specs.isbn),
    edition: cleanText(specs.edition),
    publication_year: parseYear(specs.edition),
    pages: parsePages(specs["number of pages"]),
    language: cleanText(specs.language),
    page_title: cleanText($("title").first().text())
  };
}

function candidateAuthors(candidate) {
  return (candidate.authors || [])
    .map((author) => cleanText(author.name_bn || author.name_en))
    .filter(Boolean)
    .filter((author) => !genericAuthorPattern.test(author));
}

function uniqueAuthors(authors) {
  const seen = new Set();
  return authors.filter((author) => {
    const authorKey = `${key(author.name_bn || author.name_en)}|${author.role || "author"}`;
    if (!authorKey || seen.has(authorKey)) return false;
    seen.add(authorKey);
    return true;
  });
}

function splitAuthorEntry(author) {
  const nameBn = cleanText(author.name_bn);
  if (!nameBn || !nameBn.includes(",")) return [author];
  const parts = nameBn.split(/\s*,\s*/).map(cleanText).filter((part) => part && hasBangla(part));
  if (parts.length <= 1) return [author];
  return parts.map((part) => ({
    ...author,
    name_bn: part,
    name_en: null
  }));
}

function scoreProduct(candidate, product) {
  const title = candidate.title_bn || candidate.title_en;
  const authors = candidateAuthors(candidate);
  const titleCandidates = [product.title_bn, product.title_en, product.page_title].filter(Boolean);
  const authorCandidates = [product.author_bn, product.author_en].filter(Boolean);
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
  if (!product.title_bn || !hasBangla(product.title_bn)) return false;
  if (!product.author_bn || !hasBangla(product.author_bn)) return false;
  if (!candidateAuthors(candidate).length) return false;
  if (scores.title_score >= 0.9 && scores.author_score >= 0.65) return true;
  return false;
}

function buildMainRokomariIndex() {
  const sources = readJsonl(tables.sources);
  const works = readJsonl(tables.works);
  const editions = readJsonl(tables.editions);
  const sourceIdsByProductId = new Map();
  const workIdBySourceId = new Map();

  for (const source of sources) {
    const productId = parseRokomariId(source.url) || (source.id || "").match(/^source_rokomari_book_(\d+)$/)?.[1] || null;
    if (!productId) continue;
    const list = sourceIdsByProductId.get(productId) || [];
    list.push(source.id);
    sourceIdsByProductId.set(productId, list);
  }

  for (const work of works) {
    for (const sourceId of work.source_refs || []) workIdBySourceId.set(sourceId, work.id);
  }

  for (const edition of editions) {
    for (const sourceId of edition.source_refs || []) {
      if (!workIdBySourceId.has(sourceId)) workIdBySourceId.set(sourceId, edition.work_id);
    }
  }

  return { sourceIdsByProductId, workIdBySourceId };
}

function existingMainWorkId(product, index) {
  const sourceIds = index.sourceIdsByProductId.get(product.product_id) || [];
  for (const sourceId of sourceIds) {
    const workId = index.workIdBySourceId.get(sourceId);
    if (workId) return workId;
  }
  return null;
}

function candidateResearchStatus(candidate) {
  const text = JSON.stringify(candidate.sources || []);
  const match = text.match(/Candidate source research:\s*([a-z_]+)/i);
  return match?.[1] || null;
}

function searchQueriesFor(candidate) {
  const title = cleanText(candidate.title_bn || candidate.title_en);
  const authors = candidateAuthors(candidate);
  const queries = [];
  if (title && authors[0]) queries.push(`${title} ${authors[0]}`);
  if (title) queries.push(title);
  return Array.from(new Set(queries));
}

function loadQueue() {
  const candidates = readJsonl(generated.candidateBooks);
  return candidates
    .filter((candidate) => hasBangla(candidate.title_bn || candidate.title_en))
    .filter((candidate) => (candidate.reason || "").includes("Internet Archive is the only source reference"))
    .filter((candidate) => candidateResearchStatus(candidate) !== "not_book")
    .filter((candidate) => candidateResearchStatus(candidate) !== "not_bangla_book")
    .filter((candidate) => candidateAuthors(candidate).length > 0)
    .slice(offset, offset + limit);
}

async function researchCandidate(candidate, index) {
  const queries = searchQueriesFor(candidate);
  const seen = new Set();
  const matches = [];

  for (const query of queries) {
    const html = await fetchText(searchUrl(query));
    const cards = parseSearchCards(html).slice(0, maxCards);
    for (const card of cards) {
      if (seen.has(card.product_id)) continue;
      seen.add(card.product_id);
      await sleep(delayMs);
      const product = parseProduct(await fetchText(card.url), card);
      const scores = scoreProduct(candidate, product);
      const existingWorkId = existingMainWorkId(product, index);
      matches.push({
        product,
        scores,
        accepted: isAccepted(candidate, product, scores),
        existing_work_id: existingWorkId
      });
    }
    if (matches.some((match) => match.accepted && (!match.existing_work_id || match.existing_work_id === candidate.normalized_work_id))) break;
    await sleep(delayMs);
  }

  matches.sort((a, b) => b.scores.total_score - a.scores.total_score);
  const best = matches[0] || null;
  const accepted = matches.find((match) => match.accepted) || null;

  if (accepted && accepted.existing_work_id && accepted.existing_work_id !== candidate.normalized_work_id) {
    return {
      status: "needs_manual_review",
      work_id: candidate.normalized_work_id,
      title_bn: candidate.title_bn || null,
      title_en: candidate.title_en || null,
      evidence: `Live Rokomari search found a strong title/author match, but product ${accepted.product.product_id} is already linked to ${accepted.existing_work_id}; leaving this candidate for duplicate review instead of creating another verified row.`,
      evidence_sources: [
        {
          label: "Rokomari book page",
          url: accepted.product.url,
          notes: `Matched title ${accepted.product.title_bn || accepted.product.title_en} by ${accepted.product.author_bn || accepted.product.author_en}.`
        }
      ],
      searched_queries: queries,
      best_match: accepted
    };
  }

  if (accepted) {
    const product = accepted.product;
    const sourceAuthors = uniqueAuthors(
      candidate.authors
        .map((author) => {
          const candidateNameBn = cleanText(author.name_bn);
          const productAuthorBn = cleanText(product.author_bn);
          const shouldPreferProductAuthor =
            productAuthorBn && hasBangla(productAuthorBn) && (!candidateNameBn || hasLatin(candidateNameBn));
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
      title_bn: product.title_bn || candidate.title_bn,
      title_en: product.title_en || candidate.title_en || null,
      publication_year: candidate.first_published_year || product.publication_year || null,
      authors: sourceAuthors,
      edition: {
        title_as_printed: product.title_bn || candidate.title_bn || candidate.title_en,
        publisher: product.publisher || null,
        publication_year: product.publication_year || candidate.first_published_year || null,
        isbn: product.isbn || null,
        pages: product.pages || null,
        format: "book"
      },
      evidence: `Live Rokomari search verifies ${candidate.title_bn || candidate.title_en} with matching Bangla title and author metadata.`,
      evidence_sources: [
        {
          label: "Rokomari book page",
          url: product.url,
          notes: `Lists title ${product.title_bn || product.title_en}, author ${product.author_bn || product.author_en}, publisher ${product.publisher || "unknown"}, and language ${product.language || "not parsed"}.`
        }
      ],
      searched_queries: queries,
      best_match: accepted,
      sources: [
        {
          source: "Rokomari live book page",
          url: product.url,
          external_id: product.product_id,
          record_type: "book",
          raw_title: product.title_bn || product.title_en || candidate.title_bn || candidate.title_en,
          raw_author: product.author_bn || product.author_en || candidateAuthors(candidate).join(", "),
          notes: "Current public Rokomari page confirms the candidate title and author."
        }
      ]
    };
  }

  return {
    status: "needs_manual_review",
    work_id: candidate.normalized_work_id,
    title_bn: candidate.title_bn || null,
    title_en: candidate.title_en || null,
    evidence: best
      ? `Live Rokomari search did not find a strong enough title+author match for ${candidate.title_bn || candidate.title_en}.`
      : `Live Rokomari search returned no candidate product cards for ${candidate.title_bn || candidate.title_en}.`,
    searched_queries: queries,
    best_match: best
  };
}

async function main() {
  const outPath = path.join(archiveDir, "candidate_source_research", `${researchId}.json`);
  const queue = loadQueue();
  const mainIndex = buildMainRokomariIndex();
  const items = [];

  for (const [index, candidate] of queue.entries()) {
    console.log(`[${index + 1}/${queue.length}] ${candidate.title_bn || candidate.title_en}`);
    try {
      items.push(await researchCandidate(candidate, mainIndex));
    } catch (error) {
      items.push({
        status: "needs_manual_review",
        work_id: candidate.normalized_work_id,
        title_bn: candidate.title_bn || null,
        title_en: candidate.title_en || null,
        evidence: `Live Rokomari search failed for ${candidate.title_bn || candidate.title_en}: ${error.message}`
      });
    }
    await sleep(delayMs);
  }

  const counts = {};
  for (const item of items) counts[item.status] = (counts[item.status] || 0) + 1;

  writeJson(outPath, {
    generated_at: new Date().toISOString().slice(0, 10),
    research_scope:
      "Live Rokomari search pass over generated candidate books with Bangla titles and single Internet Archive support. Promotes only strong title+author matches; duplicate existing-main matches stay manual.",
    selection_summary: {
      limit,
      offset,
      checked: items.length,
      ...counts
    },
    items
  });

  console.log(JSON.stringify({ output: path.relative(archiveDir, outPath).replaceAll("\\", "/"), checked: items.length, ...counts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
