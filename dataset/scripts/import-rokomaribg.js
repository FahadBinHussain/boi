const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { archiveDir, generated } = require("./paths");

const root = path.resolve(__dirname, "..");
const rawDir = path.join(archiveDir, "rokomaribg");
const candidateBooksPath = generated.candidateBooks;
const retrievedAt = new Date().toISOString().slice(0, 10);

const knownDatasetSources = [
  {
    label: "Bangla Book Recommendation Dataset GitHub repository",
    url: "https://github.com/backlashblitz/Bangla-Book-Recommendation-Dataset",
    retrieved_at: retrievedAt,
    notes: "Public repository for the RokomariBG Bangla book recommendation dataset."
  },
  {
    label: "Bangla Book Recommendation Dataset Hugging Face dataset",
    url: "https://huggingface.co/datasets/DevnilMaster1/Bangla-Book-Recommendation-Dataset",
    retrieved_at: retrievedAt,
    notes: "Public Hugging Face mirror for the RokomariBG dataset."
  }
];

function hash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function toId(prefix, value) {
  return `${prefix}_${hash(String(value || ""))}`;
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] === undefined ? "" : values[index].trim();
    });
    return row;
  });
}

function parseJsonLike(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    for (const key of ["books", "data", "records", "items", "rows"]) {
      if (Array.isArray(value[key])) return value[key];
    }
  }
  return [];
}

function readRows(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const text = readText(filePath);

  if (ext === ".json") {
    return parseJsonLike(JSON.parse(text));
  }

  if (ext === ".jsonl") {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  if (ext === ".csv") {
    return parseCsv(text);
  }

  return [];
}

function pick(row, names) {
  const lookup = new Map();
  Object.keys(row).forEach((key) => lookup.set(key.toLowerCase().replace(/[^a-z0-9]/g, ""), key));

  for (const name of names) {
    const key = lookup.get(name.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (key && row[key] !== undefined && row[key] !== null && String(row[key]).trim()) {
      return String(row[key]).trim();
    }
  }

  return null;
}

function makeCandidate(row, filePath, index) {
  const title = pick(row, [
    "title",
    "book_title",
    "book_name",
    "bookname",
    "name",
    "Book Name",
    "Book_Title"
  ]);
  const author = pick(row, [
    "author",
    "authors",
    "writer",
    "writers",
    "author_name",
    "Author Name",
    "Author"
  ]);

  if (!title && !author) return null;

  const relativeRawPath = path.relative(root, filePath).replace(/\\/g, "/");
  return {
    id: toId("rokomaribg_book_candidate", `${relativeRawPath}:${index}:${title}:${author}`),
    title,
    author,
    publisher: pick(row, ["publisher", "publisher_name", "Publisher"]),
    category: pick(row, ["category", "categories", "genre", "genres"]),
    isbn: pick(row, ["isbn", "ISBN"]),
    language: pick(row, ["language", "Language"]) || "bn",
    verification_status: "pending",
    reason: "Imported from raw RokomariBG data; needs normalization into works, editions, authors, and contributions.",
    raw_path: relativeRawPath,
    raw_index: index,
    sources: [
      ...knownDatasetSources,
      {
        label: `Local raw file: ${relativeRawPath}`,
        url: "file://" + filePath.replace(/\\/g, "/"),
        retrieved_at: retrievedAt,
        notes: "Local raw import file used to create this candidate record."
      }
    ],
    raw: row
  };
}

function main() {
  if (!fs.existsSync(rawDir)) {
    throw new Error(`Missing raw folder: ${rawDir}`);
  }

  const files = fs
    .readdirSync(rawDir)
    .filter((name) => [".json", ".jsonl", ".csv"].includes(path.extname(name).toLowerCase()))
    .map((name) => path.join(rawDir, name));

  if (files.length === 0) {
    console.log("No RokomariBG raw JSON/JSONL/CSV files found.");
    console.log(`Put source files in ${rawDir}`);
    return;
  }

  const candidates = [];
  for (const filePath of files) {
    const rows = readRows(filePath);
    rows.forEach((row, index) => {
      const candidate = makeCandidate(row, filePath, index);
      if (candidate) candidates.push(candidate);
    });
  }

  fs.writeFileSync(
    candidateBooksPath,
    candidates.map((candidate) => JSON.stringify(candidate)).join("\n") + (candidates.length ? "\n" : ""),
    "utf8"
  );

  console.log(`Imported ${candidates.length} RokomariBG candidate book record(s).`);
  console.log(`Wrote ${path.relative(root, candidateBooksPath)}`);
}

main();
