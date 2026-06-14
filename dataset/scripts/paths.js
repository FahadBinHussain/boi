const path = require("node:path");

const root = path.resolve(__dirname, "..");
const archiveDir = path.join(root, "archive");
const mainDir = path.join(root, "main");
const generatedDir = path.join(mainDir, "generated");
const candidatesDir = path.join(generatedDir, "candidates");
const exportsDir = path.join(generatedDir, "exports");
const reportsDir = path.join(generatedDir, "reports");

module.exports = {
  root,
  archiveDir,
  mainDir,
  generatedDir,
  candidatesDir,
  exportsDir,
  reportsDir,
  tables: {
    sources: path.join(mainDir, "source_records.jsonl"),
    authors: path.join(mainDir, "authors.jsonl"),
    works: path.join(mainDir, "works.jsonl"),
    editions: path.join(mainDir, "editions.jsonl"),
    contributions: path.join(mainDir, "contributions.jsonl")
  },
  generated: {
    candidateAuthors: path.join(candidatesDir, "authors.jsonl"),
    candidateBooks: path.join(candidatesDir, "books.jsonl"),
    titleHygieneReport: path.join(reportsDir, "title-hygiene.json")
  }
};
