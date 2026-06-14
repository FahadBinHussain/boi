const fs = require("node:fs");
const path = require("node:path");
const { archiveDir, generated } = require("./paths");

const sourceSlug = "medium-retailer-sources";
const requestedRunId = process.env.RETAILER_RUN_ID || null;
const researchFileName = process.env.RETAILER_RESEARCH_FILE || "candidate_medium_retailer_sources_2026_06_01.json";
const sourceDirs = (process.env.RETAILER_SOURCES || "boibazar,eboighar,wafilife,baatighar")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

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

function unique(values) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function key(value) {
  return cleanText(value)
    ?.toLowerCase()
    .normalize("NFKC")
    .replace(/['’`]/g, "")
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasBangla(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

const genericAuthorPattern =
  /^(?:book|books?|ebook|ebooks?|pdf|author|authors?|unknown|anonymous|various|various writers?|various author|collection|compiled|www\..+|https?:\/\/.+)$/i;

function isGenericAuthor(value) {
  const text = cleanText(value);
  return !text || genericAuthorPattern.test(text);
}

const personStopWords = new Set([
  "al",
  "bin",
  "ibn",
  "md",
  "mohammad",
  "mohammed",
  "muhammad",
  "prof",
  "professor",
  "dr",
  "doctor",
  "shaikh",
  "sheikh",
  "শাইখ",
  "শেখ",
  "আল্লামা",
  "ড",
  "ডা",
  "ডক্টর",
  "মাওলানা",
  "মুহাম্মাদ",
  "মুহাম্মদ",
  "মোহাম্মদ",
  "ইবন",
  "বিন"
]);

function personTokens(value) {
  const normalized = key(value);
  return normalized
    ? normalized
        .split(/\s+/)
        .map((token) => token.replace(/\.$/u, ""))
        .filter((token) => token.length > 1 && !personStopWords.has(token))
    : [];
}

function peopleProbablyMatch(left, right) {
  const leftKey = key(left);
  const rightKey = key(right);
  if (!leftKey || !rightKey) return false;
  if (leftKey === rightKey) return true;
  if (leftKey.length >= 8 && rightKey.includes(leftKey)) return true;
  if (rightKey.length >= 8 && leftKey.includes(rightKey)) return true;

  const leftTokens = new Set(personTokens(left));
  const rightTokens = new Set(personTokens(right));
  if (!leftTokens.size || !rightTokens.size) return false;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  const smaller = Math.min(leftTokens.size, rightTokens.size);
  return overlap >= Math.min(2, smaller) && overlap / smaller >= 0.67;
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
  if (!fs.existsSync(path.join(dir, "manifest.json"))) {
    throw new Error(`Retailer source run has no manifest: ${dir}`);
  }
  return { name: requestedRunId, dir };
}

function readSourceRows(run) {
  const rows = [];
  for (const slug of sourceDirs) {
    const filePath = path.join(run.dir, slug, "books.jsonl");
    for (const row of readJsonl(filePath)) rows.push({ ...row, source_slug: slug });
  }
  return rows;
}

function usableContributors(row) {
  return (row.contributors || []).filter((contributor) => ["author", "translator", "editor"].includes(contributor.role || "author"));
}

function contributorLabel(contributor) {
  return `${contributor.name}${contributor.role && contributor.role !== "author" ? ` (${contributor.role})` : ""}`;
}

function sourceLabel(row) {
  if (row.source === "Boibazar") return "Boibazar book catalog page";
  if (row.source === "eBoighar") return "eBoighar book detail page";
  if (row.source === "Wafilife") return "Wafilife product detail page";
  if (row.source === "Baatighar") return "Baatighar shop listing page";
  return `${row.source} book page`;
}

function recordType(row) {
  if (row.source === "Baatighar" || row.source === "Boibazar") return "book listing";
  return "book detail";
}

function groupSources(sourceRows) {
  const groups = new Map();
  for (const row of sourceRows) {
    const titleKey = key(row.title);
    if (!titleKey) continue;
    const group = groups.get(titleKey) || {
      title_key: titleKey,
      title: row.title,
      rows: [],
      contributors: [],
      publishers: [],
      publication_years: [],
      isbns: []
    };
    group.rows.push(row);
    group.contributors.push(...usableContributors(row));
    group.publishers.push(...(row.publishers || []));
    if (row.publication_year) group.publication_years.push(row.publication_year);
    if (row.isbn) group.isbns.push(row.isbn);
    groups.set(titleKey, group);
  }

  for (const group of groups.values()) {
    const contributorSeen = new Set();
    group.contributors = group.contributors.filter((contributor) => {
      const identity = `${key(contributor.name)}|${contributor.role || "author"}`;
      if (!identity || contributorSeen.has(identity)) return false;
      contributorSeen.add(identity);
      return true;
    });
    group.publishers = unique(group.publishers);
    group.publication_years = unique(group.publication_years).map(Number).filter(Boolean);
    group.isbns = unique(group.isbns);
  }

  return groups;
}

function candidateTitleKeys(candidate) {
  return unique([candidate.title_bn, candidate.title_en].map(key));
}

function candidateContributors(candidate) {
  return (candidate.authors || []).map((author) => ({
    name: author.name_bn || author.name_en,
    role: author.role || "author",
    raw: author
  }));
}

function matchCandidateToGroup(candidate, group) {
  if (!group?.contributors?.length) return null;
  const candidatePeople = candidateContributors(candidate).filter((entry) => cleanText(entry.name));
  const usableCandidatePeople = candidatePeople.filter((entry) => !isGenericAuthor(entry.name));
  const matchingPeople = [];
  const matchingRows = [];

  for (const candidatePerson of usableCandidatePeople) {
    for (const row of group.rows) {
      const rowMatches = usableContributors(row).filter((sourcePerson) => peopleProbablyMatch(candidatePerson.name, sourcePerson.name));
      for (const sourcePerson of rowMatches) {
        matchingPeople.push({ candidate: candidatePerson, source: sourcePerson });
      }
      if (rowMatches.length && !matchingRows.includes(row)) {
        matchingRows.push(row);
      }
    }
  }

  if (matchingPeople.length) {
    return {
      reason: "exact_title_and_contributor",
      matching_people: matchingPeople,
      rows: matchingRows
    };
  }

  if (!usableCandidatePeople.length) {
    const contributorSignatures = unique(
      group.rows
        .map((row) =>
          usableContributors(row)
            .map((contributor) => `${key(contributor.name)}|${contributor.role || "author"}`)
            .sort()
            .join(";")
        )
        .filter(Boolean)
    );
    if (contributorSignatures.length !== 1) return null;
    return {
      reason: "exact_title_replaces_generic_candidate_author",
      matching_people: [],
      rows: group.rows
    };
  }

  return null;
}

function narrowedGroup(group, rows) {
  const selectedRows = rows && rows.length ? rows : group.rows;
  const next = {
    ...group,
    rows: selectedRows,
    contributors: [],
    publishers: [],
    publication_years: [],
    isbns: []
  };

  for (const row of selectedRows) {
    next.contributors.push(...usableContributors(row));
    next.publishers.push(...(row.publishers || []));
    if (row.publication_year) next.publication_years.push(row.publication_year);
    if (row.isbn) next.isbns.push(row.isbn);
  }

  const contributorSeen = new Set();
  next.contributors = next.contributors.filter((contributor) => {
    const identity = `${key(contributor.name)}|${contributor.role || "author"}`;
    if (!identity || contributorSeen.has(identity)) return false;
    contributorSeen.add(identity);
    return true;
  });
  next.publishers = unique(next.publishers);
  next.publication_years = unique(next.publication_years).map(Number).filter(Boolean);
  next.isbns = unique(next.isbns);
  return next;
}

function itemAuthors(group) {
  return group.contributors.map((contributor) => {
    const field = hasBangla(contributor.name) ? "name_bn" : "name_en";
    return {
      [field]: contributor.name,
      role: contributor.role || "author"
    };
  });
}

function rawAuthor(group) {
  return group.contributors.map(contributorLabel).join("; ") || null;
}

function sourceRowsForItem(group, match) {
  return group.rows.map((row) => ({
    source: sourceLabel(row),
    url: row.url,
    record_type: recordType(row),
    raw_title: row.title,
    raw_author: rawAuthor({
      contributors: usableContributors(row)
    }),
    notes:
      match.reason === "exact_title_and_contributor"
        ? "Current retailer catalog page confirms the same normalized title and at least one matching contributor."
        : "Current retailer catalog page confirms the exact title and supplies usable contributor metadata where the candidate had only generic or missing author text."
  }));
}

function buildResearchItem(candidate, group, match) {
  const titleBn = hasBangla(group.title) ? group.title : candidate.title_bn;
  const titleEn = candidate.title_en && candidate.title_en !== titleBn ? candidate.title_en : null;
  const publicationYear = group.publication_years[0] || candidate.first_published_year || null;
  const publisher = group.publishers[0] || null;
  const sourceNames = unique(group.rows.map((row) => row.source)).join(", ");
  const contributorText = rawAuthor(group);
  const isbn = group.isbns[0] || null;

  return {
    status: "supported_book",
    work_id: candidate.normalized_work_id,
    title_bn: titleBn,
    ...(titleEn ? { title_en: titleEn } : {}),
    publication_year: publicationYear,
    authors: itemAuthors(group),
    edition: {
      title_as_printed: group.title,
      ...(publisher ? { publisher } : {}),
      ...(publicationYear ? { publication_year: publicationYear } : {}),
      ...(isbn ? { isbn } : {}),
      format: "book"
    },
    evidence:
      match.reason === "exact_title_and_contributor"
        ? `${sourceNames} lists ${group.title}${contributorText ? ` with ${contributorText}` : ""}; the normalized title and contributor evidence match the pending candidate.`
        : `${sourceNames} lists ${group.title}${contributorText ? ` with ${contributorText}` : ""}; the pending candidate has the same normalized title but only generic or missing author metadata, so this current catalog record supplies the supporting source.`,
    evidence_sources: group.rows.map((row) => ({
      label: sourceLabel(row),
      url: row.url,
      notes: `${row.source} confirms title${usableContributors(row).length ? " and contributor metadata" : ""}${row.publication_year ? ` with ${row.publication_year} date metadata` : ""}.`
    })),
    sources: sourceRowsForItem(group, match)
  };
}

function reviewRow(candidate, group) {
  return {
    work_id: candidate.normalized_work_id,
    candidate_title_bn: candidate.title_bn,
    candidate_title_en: candidate.title_en,
    candidate_authors: candidateContributors(candidate).map((entry) => entry.name),
    source_title: group.title,
    source_contributors: group.contributors.map(contributorLabel),
    source_urls: group.rows.map((row) => row.url),
    reason: "same normalized title, but no contributor overlap and candidate authors were not generic"
  };
}

function main() {
  const run = selectedRun();
  const sourceRows = readSourceRows(run);
  const groupsByTitle = groupSources(sourceRows);
  const candidates = readJsonl(generated.candidateBooks);
  const items = [];
  const reviewRows = [];
  const seenWorkIds = new Set();
  let exactTitleCandidates = 0;

  for (const candidate of candidates) {
    if (seenWorkIds.has(candidate.normalized_work_id)) continue;
    const groups = [];
    const seenTitleKeys = new Set();
    for (const titleKey of candidateTitleKeys(candidate)) {
      const group = groupsByTitle.get(titleKey);
      if (!group || seenTitleKeys.has(group.title_key)) continue;
      groups.push(group);
      seenTitleKeys.add(group.title_key);
    }
    if (!groups.length) continue;
    exactTitleCandidates += 1;

    const matched = groups
      .map((group) => ({ group, match: matchCandidateToGroup(candidate, group) }))
      .find((entry) => entry.match);

    if (matched) {
      items.push(buildResearchItem(candidate, narrowedGroup(matched.group, matched.match.rows), matched.match));
      seenWorkIds.add(candidate.normalized_work_id);
      continue;
    }

    reviewRows.push(...groups.map((group) => reviewRow(candidate, group)));
  }

  const researchDir = path.join(archiveDir, "candidate_source_research");
  const researchPath = path.join(researchDir, researchFileName);
  const reviewPath = path.join(run.dir, "candidate-title-only-review.jsonl");
  const generatedAt = new Date().toISOString().slice(0, 10);

  writeJson(researchPath, {
    generated_at: generatedAt,
    research_scope:
      "Automated exact-title reconciliation for pending generated BOI candidates against the metadata-only medium retailer scrape. Promotes only exact normalized-title matches with matching contributor evidence, or exact-title rows where the candidate had only generic/missing author metadata and the current catalog supplies usable contributors.",
    source_archive: `${sourceSlug}/${run.name}`,
    selection_summary: {
      checked_candidates: candidates.length,
      source_records: sourceRows.length,
      exact_title_candidates: exactTitleCandidates,
      supported_book: items.length,
      title_only_review: reviewRows.length
    },
    review_file: path.relative(archiveDir, reviewPath).replaceAll("\\", "/"),
    items
  });
  writeJsonl(reviewPath, reviewRows);

  console.log(
    JSON.stringify(
      {
        run_id: run.name,
        research_file: path.relative(archiveDir, researchPath).replaceAll("\\", "/"),
        review_file: path.relative(archiveDir, reviewPath).replaceAll("\\", "/"),
        checked_candidates: candidates.length,
        source_records: sourceRows.length,
        exact_title_candidates: exactTitleCandidates,
        supported_book: items.length,
        title_only_review: reviewRows.length
      },
      null,
      2
    )
  );
}

main();
