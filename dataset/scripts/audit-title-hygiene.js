const fs = require("node:fs");
const path = require("node:path");
const { exportsDir, reportsDir, generated } = require("./paths");

const checkMode = process.argv.includes("--check");
const reportPath = generated.titleHygieneReport;
const SAMPLE_LIMIT = Number(process.env.DATASET_AUDIT_SAMPLE_LIMIT || 100);

function cleanText(value) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function hasBanglaScript(value) {
  return /[\u0980-\u09FF]/.test(String(value || ""));
}

function hasLatinScript(value) {
  return /[A-Za-z]/.test(String(value || ""));
}

function normalizedTextKey(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countCharacter(value, character) {
  return Array.from(String(value || "")).filter((item) => item === character).length;
}

function titleSamples(rows, predicate) {
  return rows
    .flatMap((row) =>
      [
        ["title_bn", cleanText(row.title_bn)],
        ["title_en", cleanText(row.title_en)]
      ]
        .filter(([, title]) => title)
        .map(([field, title]) => ({ row, field, title }))
    )
    .filter(predicate)
    .slice(0, SAMPLE_LIMIT)
    .map(({ row, field, title }) => ({
      id: row.id,
      field,
      title,
      authors: (row.authors || []).map((author) => author.name_bn || author.name_en || author.id).filter(Boolean),
      source_refs: row.source_refs || []
    }));
}

function countTitleMatches(rows, predicate) {
  return rows
    .flatMap((row) =>
      [
        ["title_bn", cleanText(row.title_bn)],
        ["title_en", cleanText(row.title_en)]
      ]
        .filter(([, title]) => title)
        .map(([field, title]) => ({ row, field, title }))
    )
    .filter(predicate).length;
}

function titleHasDanglingPunctuation(title) {
  return /\s*(?:[,،;:|/\\]|[-–—])+\s*$/u.test(title);
}

function titleHasBrokenOuterBracket(title) {
  if (/[\(\[\{（［｛]\s*$/u.test(title) || /^[\)\]\}）］｝]/u.test(title)) return true;
  const bracketPairs = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
    ["（", "）"],
    ["［", "］"],
    ["｛", "｝"]
  ];

  return bracketPairs.some(([open, close]) => countCharacter(title, close) > countCharacter(title, open) && title.endsWith(close));
}

function authorSuffixPattern(authors) {
  const authorNames = authors.flatMap((author) => [author.name_bn, author.name_en]).map(cleanText).filter(Boolean);
  if (!authorNames.length) return null;
  const roleWords =
    "(?:সম্পাদিত|সম্পাদক|রচিত|লিখিত|অনূদিত|অনুবাদ|সংকলিত|গ্রন্থনা|গ্রন্থিত|edited|editor|translated|compiled|by)";
  const names = authorNames.map(escapeRegExp).join("|");
  return new RegExp(
    `(?:(?:\\s*[,،;|]\\s*|\\s+[-–—]\\s+)(${names})(?:\\s+${roleWords})?|\\s+(${names})\\s+${roleWords})\\s*$`,
    "iu"
  );
}

function titleHasAuthorSuffix(row, title) {
  const pattern = authorSuffixPattern(row.authors || []);
  if (!pattern) return false;
  return pattern.test(title);
}

function titleHasUnsafeAuthorMention(row, title) {
  const titleKey = normalizedTextKey(title);
  if (!titleKey) return false;
  return (row.authors || []).some((author) => {
    const names = [author.name_bn, author.name_en].map(normalizedTextKey).filter(Boolean);
    return names.some((name) => name && titleKey.includes(name) && titleKey !== name);
  });
}

function titleHasMixedScript(row, field, title) {
  if (field !== "title_bn") return false;
  if (!hasBanglaScript(title) || !hasLatinScript(title)) return false;
  return !cleanText(row.title_en);
}

function titleLooksLikeSafeParentheticalSplit(row, field, title) {
  if (field !== "title_bn" || cleanText(row.title_en)) return false;
  return /^[\s\S]*[\(\[（［]\s*[A-Za-z][^()\[\]{}（）［］｛｝]*[A-Za-z0-9.]\s*[\)\]）］]\s*$/u.test(title);
}

function buildReport(rows) {
  const blockingPredicates = {
    dangling_punctuation: ({ title }) => titleHasDanglingPunctuation(title),
    broken_outer_bracket: ({ title }) => titleHasBrokenOuterBracket(title),
    author_suffix: ({ row, title }) => titleHasAuthorSuffix(row, title),
    safe_parenthetical_split: ({ row, field, title }) => titleLooksLikeSafeParentheticalSplit(row, field, title)
  };

  const warningPredicates = {
    mixed_script_title_without_english_field: ({ row, field, title }) => titleHasMixedScript(row, field, title),
    author_name_inside_title: ({ row, title }) => titleHasUnsafeAuthorMention(row, title)
  };

  const blocking = Object.fromEntries(
    Object.entries(blockingPredicates).map(([name, predicate]) => [
      name,
      {
        count: countTitleMatches(rows, predicate),
        samples: titleSamples(rows, predicate)
      }
    ])
  );

  const warnings = Object.fromEntries(
    Object.entries(warningPredicates).map(([name, predicate]) => [
      name,
      {
        count: countTitleMatches(rows, predicate),
        samples: titleSamples(rows, predicate)
      }
    ])
  );

  return {
    format_version: 1,
    generated_at: new Date().toISOString(),
    total_works: rows.length,
    blocking,
    warnings
  };
}

function readExportJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(exportsDir, relativePath), "utf8"));
}

function readPagedBookRows(datasetName) {
  const manifest = readExportJson(`${datasetName}-manifest.json`);
  const sort = manifest.default_sort?.key || "title";
  const direction = manifest.default_sort?.direction || "asc";
  const files = manifest.sorts?.[sort]?.[direction]?.files || [];
  return files.flatMap((file) => readExportJson(file).rows || []);
}

const rows = readPagedBookRows("works");
const report = buildReport(rows);
const blockingCount = Object.values(report.blocking).reduce((total, entry) => total + entry.count, 0);

if (!checkMode) {
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (blockingCount > 0) {
  console.error(`Dataset title hygiene found ${blockingCount} blocking issue(s).`);
  for (const [name, entry] of Object.entries(report.blocking)) {
    if (entry.count > 0) console.error(`- ${name}: ${entry.count}`);
  }
  process.exit(1);
}

console.log("Dataset title hygiene passed.");
for (const [name, entry] of Object.entries(report.warnings)) {
  console.log(`Warning candidates - ${name}: ${entry.count}`);
}
