const fs = require("node:fs");
const path = require("node:path");
const { archiveDir, generated } = require("./paths");

const researchId =
  process.env.CANDIDATE_LIVE_SOURCE_RESEARCH_ID ||
  `candidate_live_sources_${new Date().toISOString().slice(0, 10).replaceAll("-", "_")}`;
const limit = Number(process.env.CANDIDATE_LIVE_SOURCE_LIMIT || 100);
const offset = Number(process.env.CANDIDATE_LIVE_SOURCE_OFFSET || 0);
const delayMs = Number(process.env.CANDIDATE_LIVE_SOURCE_DELAY_MS || 350);

const archiveHosts = new Set(["archive.org", "openlibrary.org"]);
const stopWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "book",
  "books",
  "by",
  "ed",
  "edition",
  "pdf",
  "the",
  "vol",
  "volume"
]);

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function key(value) {
  return cleanText(value)
    ?.toLowerCase()
    .normalize("NFKC")
    .replace(/&/g, " and ")
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  const normalized = key(value);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function hostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function sourceName(source) {
  const label = cleanText(source.label || source.source);
  return label?.split(":")[0] || "Candidate source research";
}

function dliIdFromValue(value) {
  const text = String(value || "");
  return text.match(/dli_ndli\/(\d+)/i)?.[1] || text.match(/dli\.2015\.(\d+)/i)?.[1] || null;
}

function pageTitle(html) {
  return cleanText(String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
}

function sourceExternalId(source) {
  return dliIdFromValue(source.url) || String(source.url || "").match(/\/book\/(\d+)(?:\/|$)/)?.[1] || null;
}

function candidateAuthors(candidate) {
  return (candidate.authors || [])
    .map((author) => cleanText(author.name_bn || author.name_en))
    .filter(Boolean);
}

function sourceRows(candidate) {
  return (candidate.sources || []).filter((source) => {
    const host = hostname(source.url);
    return host && !archiveHosts.has(host);
  });
}

function loadQueue() {
  const candidates = readJsonl(generated.candidateBooks);
  return candidates
    .filter((candidate) => (candidate.reason || "").includes("Internet Archive marks this as Bengali-language text"))
    .filter((candidate) => sourceRows(candidate).length > 0)
    .slice(offset, offset + limit);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "bn,en-US;q=0.9,en;q=0.8",
      "cache-control": "no-cache"
    }
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text, finalUrl: response.url };
}

function titleTokenMatch(candidateTitle, haystack) {
  const titleTokens = tokens(candidateTitle);
  const haystackTokens = new Set(tokens(haystack));
  if (!titleTokens.length || !haystackTokens.size) return false;
  const hits = titleTokens.filter((token) => haystackTokens.has(token)).length;
  if (titleTokens.length <= 2) return hits === titleTokens.length;
  return hits >= Math.max(2, Math.ceil(titleTokens.length * 0.65));
}

function authorTokenMatch(candidate, haystack) {
  const authorTokens = candidateAuthors(candidate).flatMap(tokens);
  if (!authorTokens.length) return true;
  const haystackTokens = new Set(tokens(haystack));
  const hits = authorTokens.filter((token) => haystackTokens.has(token)).length;
  return hits > 0;
}

function verifySource(candidate, source, result) {
  const title = candidate.title_bn || candidate.title_en;
  const titleText = pageTitle(result.text);
  const bodyText = cleanText(result.text) || "";
  const host = hostname(source.url);
  const sourceDliId = dliIdFromValue(source.url);
  const archiveDliIds = new Set((candidate.sources || []).map((entry) => dliIdFromValue(entry.url)).filter(Boolean));

  if (!result.ok) return { ok: false, reason: `HTTP ${result.status}` };
  if (/page not found|404/i.test(titleText || "")) return { ok: false, reason: "page title says not found" };

  if (host === "ndl.iitkgp.ac.in") {
    const ndliTitle = cleanText((titleText || "").replace(/^NDLI:\s*/i, ""));
    const idMatchesArchive = sourceDliId && archiveDliIds.has(sourceDliId);
    const titleMatches = titleTokenMatch(title, ndliTitle || titleText || bodyText);
    return {
      ok: Boolean(idMatchesArchive && titleMatches),
      reason: idMatchesArchive
        ? titleMatches
          ? `NDLI title ${ndliTitle || titleText} matches DLI ${sourceDliId}`
          : `NDLI DLI ${sourceDliId} resolved but title did not match`
        : `NDLI DLI ${sourceDliId || "unknown"} does not match an Archive DLI id`
    };
  }

  const exactTitle = titleTokenMatch(title, `${titleText || ""} ${bodyText}`);
  const authorHit = authorTokenMatch(candidate, bodyText);
  return {
    ok: exactTitle && authorHit,
    reason:
      exactTitle && authorHit
        ? `${host} page contains matching title${candidateAuthors(candidate).length ? " and author tokens" : ""}`
        : `${host} page did not contain enough title/author evidence`
  };
}

async function researchCandidate(candidate) {
  const verified = [];
  const checked = [];

  for (const source of sourceRows(candidate)) {
    try {
      const result = await fetchText(source.url);
      const verification = verifySource(candidate, source, result);
      checked.push({
        url: source.url,
        status: result.status,
        page_title: pageTitle(result.text),
        ok: verification.ok,
        reason: verification.reason
      });
      if (verification.ok) {
        verified.push({
          source: sourceName(source),
          url: source.url,
          external_id: sourceExternalId(source),
          record_type: "book",
          raw_title: candidate.title_bn || candidate.title_en,
          raw_author: candidateAuthors(candidate).join(", "),
          notes: `Live source check confirms ${verification.reason}.`
        });
      }
    } catch (error) {
      checked.push({
        url: source.url,
        status: null,
        page_title: null,
        ok: false,
        reason: error.message
      });
    }
    await sleep(delayMs);
  }

  const base = {
    work_id: candidate.normalized_work_id,
    title_bn: candidate.title_bn || null,
    title_en: candidate.title_en || null,
    publication_year: candidate.first_published_year || null,
    authors: (candidate.authors || []).map((author) => ({
      name_bn: author.name_bn || null,
      name_en: author.name_en || null,
      role: author.role || "author"
    })),
    checked_sources: checked
  };

  if (verified.length) {
    return {
      ...base,
      status: "supported_book",
      edition: {
        title_as_printed: candidate.title_bn || candidate.title_en,
        publication_year: candidate.first_published_year || null,
        format: "book"
      },
      evidence: `Live non-Archive source check verifies ${candidate.title_bn || candidate.title_en}; the row already has Internet Archive Bengali-text metadata, and the resolving external source confirms the same bibliographic record.`,
      evidence_sources: verified.map((source) => ({
        label: source.source,
        url: source.url,
        notes: source.notes
      })),
      sources: verified
    };
  }

  return {
    ...base,
    status: "needs_manual_review",
    evidence: `Live non-Archive source check did not produce a current exact source match for ${candidate.title_bn || candidate.title_en}.`
  };
}

async function main() {
  const queue = loadQueue();
  const items = [];

  for (const [index, candidate] of queue.entries()) {
    console.log(`[${index + 1}/${queue.length}] ${candidate.title_bn || candidate.title_en}`);
    items.push(await researchCandidate(candidate));
  }

  const counts = {};
  for (const item of items) counts[item.status] = (counts[item.status] || 0) + 1;

  const outPath = path.join(archiveDir, "candidate_source_research", `${researchId}.json`);
  writeJson(outPath, {
    generated_at: new Date().toISOString().slice(0, 10),
    research_scope:
      "Live source check for generated candidates that already have Internet Archive Bengali-text metadata plus a non-Archive support URL. Promotes only rows whose current external page resolves and matches the same title/DLI record.",
    selection_summary: {
      limit,
      offset,
      checked: items.length,
      ...counts
    },
    items
  });

  console.log(
    JSON.stringify(
      {
        output: path.relative(archiveDir, outPath).replaceAll("\\", "/"),
        checked: items.length,
        ...counts
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
