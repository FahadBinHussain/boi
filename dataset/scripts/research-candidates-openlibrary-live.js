const fs = require("node:fs");
const path = require("node:path");
const { archiveDir, generated } = require("./paths");

const researchId =
  process.env.CANDIDATE_OPENLIBRARY_RESEARCH_ID ||
  `candidate_openlibrary_live_${new Date().toISOString().slice(0, 10).replaceAll("-", "_")}`;
const limit = Number(process.env.CANDIDATE_OPENLIBRARY_LIMIT || 100);
const offset = Number(process.env.CANDIDATE_OPENLIBRARY_OFFSET || 0);
const delayMs = Number(process.env.CANDIDATE_OPENLIBRARY_DELAY_MS || 250);
const skipArchived = process.env.CANDIDATE_OPENLIBRARY_SKIP_ARCHIVED !== "0";

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
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

function parseYear(value) {
  const match = String(value || "").match(/(?:1[5-9]|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function openLibraryWorkId(candidate) {
  const sourceUrl = (candidate.sources || []).map((source) => source.url || "").find((url) => /openlibrary\.org\/works\//i.test(url));
  return sourceUrl?.match(/\/works\/(OL\d+W)/i)?.[1] || null;
}

function openLibrarySource(candidate) {
  return (candidate.sources || []).find((source) => /openlibrary\.org\/works\//i.test(source.url || "")) || null;
}

function candidateResearchStatus(candidate) {
  const text = JSON.stringify(candidate.sources || []);
  const match = text.match(/Candidate source research:\s*([a-z_]+)/i);
  return match?.[1] || null;
}

function loadArchivedOpenLibraryWorkIds() {
  if (!skipArchived) return new Set();

  const researchDir = path.join(archiveDir, "candidate_source_research");
  if (!fs.existsSync(researchDir)) return new Set();

  const ids = new Set();
  for (const entry of fs.readdirSync(researchDir)) {
    if (!/^candidate_openlibrary_live.*\.json$/i.test(entry)) continue;
    const filePath = path.join(researchDir, entry);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      for (const item of data.items || []) {
        if (item.work_id) ids.add(item.work_id);
      }
    } catch (error) {
      console.warn(`Skipping unreadable Open Library research file ${entry}: ${error.message}`);
    }
  }
  return ids;
}

function loadQueue() {
  const candidates = readJsonl(generated.candidateBooks);
  const archivedWorkIds = loadArchivedOpenLibraryWorkIds();
  return candidates
    .filter((candidate) => (candidate.reason || "").startsWith("Open Library marks this as Bengali/Bengali-literature metadata"))
    .filter((candidate) => candidateResearchStatus(candidate) !== "not_book")
    .filter((candidate) => candidateResearchStatus(candidate) !== "not_bangla_book")
    .filter((candidate) => !archivedWorkIds.has(candidate.normalized_work_id))
    .filter((candidate) => openLibraryWorkId(candidate))
    .slice(offset, offset + limit);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "BOI dataset verifier; contact: https://github.com/FahadBinHussain/boi",
      accept: "application/json"
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return JSON.parse(text);
}

function hasBengaliLanguage(editions) {
  return editions.some((edition) =>
    (edition.languages || []).some((language) => {
      const key = typeof language === "string" ? language : language?.key || language?.name || "";
      return /\/languages\/ben\b|bengali|bangla/i.test(String(key));
    })
  );
}

function hasBengaliSubject(work, editions) {
  const values = [
    ...(work.subjects || []),
    ...(work.subject_places || []),
    ...(work.subject_people || []),
    ...(work.subject_times || []),
    ...editions.flatMap((edition) => edition.subjects || [])
  ];
  return values.some((value) => /\b(?:bengali|bangla)\b/i.test(String(value || "")));
}

function bestEdition(candidate, editions) {
  const withBengaliLanguage = editions.find((edition) =>
    (edition.languages || []).some((language) => /\/languages\/ben\b|bengali|bangla/i.test(String(language?.key || language?.name || language || "")))
  );
  return withBengaliLanguage || editions[0] || null;
}

function isbnFromEdition(edition) {
  return cleanText([...(edition?.isbn_13 || []), ...(edition?.isbn_10 || [])][0]);
}

function sourceAuthors(candidate) {
  return (candidate.authors || [])
    .map((author) => ({
      name_bn: author.name_bn || null,
      name_en: author.name_en || null,
      role: author.role || "author"
    }))
    .filter((author) => cleanText(author.name_bn || author.name_en));
}

async function researchCandidate(candidate) {
  const workId = openLibraryWorkId(candidate);
  const workUrl = `https://openlibrary.org/works/${workId}`;
  const workApiUrl = `https://openlibrary.org/works/${workId}.json`;
  const editionsApiUrl = `https://openlibrary.org/works/${workId}/editions.json?limit=25`;
  const source = openLibrarySource(candidate);

  await sleep(delayMs);
  const work = await fetchJson(workApiUrl);
  await sleep(delayMs);
  const editionData = await fetchJson(editionsApiUrl);
  const editions = editionData.entries || [];
  const languageSignal = hasBengaliLanguage(editions);
  const subjectSignal = hasBengaliSubject(work, editions);
  const chosenEdition = bestEdition(candidate, editions);
  const supported = languageSignal || subjectSignal;
  const title = cleanText(chosenEdition?.title || work.title || candidate.title_bn || candidate.title_en);
  const publicationYear =
    parseYear(chosenEdition?.publish_date) || parseYear(work.first_publish_date) || candidate.first_published_year || null;

  const checked = {
    work_url: workUrl,
    work_title: cleanText(work.title),
    edition_count: editionData.size || editions.length,
    checked_editions: editions.length,
    language_signal: languageSignal,
    subject_signal: subjectSignal,
    chosen_edition_key: chosenEdition?.key || null,
    chosen_edition_title: cleanText(chosenEdition?.title),
    chosen_edition_publish_date: cleanText(chosenEdition?.publish_date),
    subjects: (work.subjects || []).filter((subject) => /\b(?:bengali|bangla)\b/i.test(String(subject))).slice(0, 10)
  };

  if (!supported) {
    return {
      status: "needs_manual_review",
      work_id: candidate.normalized_work_id,
      title_bn: candidate.title_bn || null,
      title_en: candidate.title_en || null,
      evidence: `Open Library live API did not expose a Bengali-language edition or Bengali/Bangla subject signal for ${candidate.title_bn || candidate.title_en}.`,
      checked
    };
  }

  return {
    status: "supported_book",
    work_id: candidate.normalized_work_id,
    title_bn: candidate.title_bn || null,
    title_en: title || candidate.title_en || null,
    publication_year: publicationYear,
    authors: sourceAuthors(candidate),
    edition: {
      title_as_printed: title || candidate.title_bn || candidate.title_en,
      publisher: cleanText((chosenEdition?.publishers || [])[0]),
      publication_year: publicationYear,
      isbn: isbnFromEdition(chosenEdition),
      pages: chosenEdition?.number_of_pages || null,
      format: "book"
    },
    evidence: `Current Open Library work/edition API verifies ${candidate.title_bn || candidate.title_en}: ${languageSignal ? "at least one edition is marked Bengali (/languages/ben)" : "the work/edition has a Bengali/Bangla subject signal"}.`,
    evidence_sources: [
      {
        label: `Open Library: ${work.title || candidate.title_en}`,
        url: workUrl,
        notes: `Live API checked ${editions.length} edition record(s); language_signal=${languageSignal}; subject_signal=${subjectSignal}.`
      }
    ],
    checked,
    sources: [
      {
        source: "Open Library live work/editions API",
        url: workUrl,
        external_id: workId,
        record_type: "book",
        raw_title: title || candidate.title_bn || candidate.title_en,
        raw_author: sourceAuthors(candidate)
          .map((author) => author.name_bn || author.name_en)
          .filter(Boolean)
          .join(", "),
        notes: `Current Open Library API confirms Bengali candidate scope: language_signal=${languageSignal}; subject_signal=${subjectSignal}. Original source: ${source?.label || source?.url || workUrl}.`
      }
    ]
  };
}

async function main() {
  const queue = loadQueue();
  const items = [];

  for (const [index, candidate] of queue.entries()) {
    console.log(`[${index + 1}/${queue.length}] ${candidate.title_bn || candidate.title_en}`);
    try {
      items.push(await researchCandidate(candidate));
    } catch (error) {
      items.push({
        status: "needs_manual_review",
        work_id: candidate.normalized_work_id,
        title_bn: candidate.title_bn || null,
        title_en: candidate.title_en || null,
        evidence: `Open Library live API check failed for ${candidate.title_bn || candidate.title_en}: ${error.message}`
      });
    }
  }

  const counts = {};
  for (const item of items) counts[item.status] = (counts[item.status] || 0) + 1;

  const outPath = path.join(archiveDir, "candidate_source_research", `${researchId}.json`);
  writeJson(outPath, {
    generated_at: new Date().toISOString().slice(0, 10),
    research_scope:
      "Live Open Library work and editions API verification for romanized Open Library Bengali candidates. Promotes only rows with /languages/ben edition metadata or clear Bengali/Bangla subject metadata.",
    selection_summary: {
      limit,
      offset,
      skip_archived: skipArchived,
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
