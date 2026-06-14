const fs = require("node:fs");
const path = require("node:path");

const PAGED_TABLES = new Map([
  [
    "source_records.jsonl",
    {
      dir: "source_records",
      table: "source_records",
      pageSize: Number(process.env.DATASET_SOURCE_RECORDS_PAGE_SIZE || 15000)
    }
  ],
  [
    "works.jsonl",
    {
      dir: "works",
      table: "works",
      pageSize: Number(process.env.DATASET_WORKS_JSONL_PAGE_SIZE || 50000)
    }
  ],
  [
    "editions.jsonl",
    {
      dir: "editions",
      table: "editions",
      pageSize: Number(process.env.DATASET_EDITIONS_JSONL_PAGE_SIZE || 50000)
    }
  ],
  [
    "contributions.jsonl",
    {
      dir: "contributions",
      table: "contributions",
      pageSize: Number(process.env.DATASET_CONTRIBUTIONS_JSONL_PAGE_SIZE || 50000)
    }
  ]
]);

function stableJsonl(rows) {
  return rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function pagedTableConfig(filePath) {
  return PAGED_TABLES.get(path.basename(filePath)) || null;
}

function isPagedTablePath(filePath) {
  return Boolean(pagedTableConfig(filePath));
}

function pagedTableDir(filePath) {
  const config = pagedTableConfig(filePath);
  return path.join(path.dirname(filePath), config.dir);
}

function pagedTableManifestPath(filePath) {
  return path.join(pagedTableDir(filePath), "manifest.json");
}

function pagedTablePageFiles(filePath) {
  const dir = pagedTableDir(filePath);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\d{4}\.jsonl$/.test(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function parseJsonlFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function readJsonl(filePath) {
  if (!isPagedTablePath(filePath)) return parseJsonlFile(filePath);

  const pages = pagedTablePageFiles(filePath);
  if (pages.length) return pages.flatMap(parseJsonlFile);
  return parseJsonlFile(filePath);
}

function readJsonlWithLocations(filePath, root = process.cwd()) {
  const files = isPagedTablePath(filePath) && pagedTablePageFiles(filePath).length ? pagedTablePageFiles(filePath) : [filePath];
  const rows = [];

  for (const currentFile of files) {
    if (!fs.existsSync(currentFile)) continue;
    const relativePath = path.relative(root, currentFile).replaceAll("\\", "/");
    const lines = fs.readFileSync(currentFile, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      rows.push({
        raw: trimmed,
        line: files.length > 1 ? `${relativePath}:${index + 1}` : index + 1,
        filePath: currentFile
      });
    });
  }

  return rows;
}

function writePagedTable(filePath, rows) {
  const config = pagedTableConfig(filePath);
  const dir = pagedTableDir(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const pages = [];
  for (let index = 0; index < rows.length; index += config.pageSize) {
    const pageRows = rows.slice(index, index + config.pageSize);
    const pageNumber = pages.length + 1;
    const pageName = `${String(pageNumber).padStart(4, "0")}.jsonl`;
    const pagePath = path.join(dir, pageName);
    const contents = stableJsonl(pageRows);
    fs.writeFileSync(pagePath, contents, "utf8");
    pages.push({
      path: pageName,
      count: pageRows.length,
      bytes: Buffer.byteLength(contents)
    });
  }

  const activePageNames = new Set(pages.map((page) => page.path));
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && /^\d{4}\.jsonl$/.test(entry.name) && !activePageNames.has(entry.name)) {
      fs.unlinkSync(path.join(dir, entry.name));
    }
  }

  fs.writeFileSync(
    pagedTableManifestPath(filePath),
    stableJson({
      format_version: 1,
      table: config.table,
      page_size: config.pageSize,
      total_count: rows.length,
      pages
    }),
    "utf8"
  );

  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function writeJsonl(filePath, rows) {
  if (isPagedTablePath(filePath)) {
    writePagedTable(filePath, rows);
    return;
  }

  fs.writeFileSync(filePath, stableJsonl(rows), "utf8");
}

function countJsonlRows(filePath) {
  return readJsonl(filePath).length;
}

module.exports = {
  countJsonlRows,
  isPagedTablePath,
  readJsonl,
  readJsonlWithLocations,
  pagedTableDir,
  pagedTableManifestPath,
  pagedTablePageFiles,
  writeJsonl
};
