const fs = require("node:fs");
const { tables: paths } = require("./paths");

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function normalizedKey(value) {
  return cleanText(value)
    ?.toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, " ")
    .trim();
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function writeJsonl(filePath, rows) {
  fs.writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
}

function asciiDigits(value) {
  const digits = "০১২৩৪৫৬৭৮৯";
  return String(value || "").replace(/[\u09E6-\u09EF]/g, (digit) => String(digits.indexOf(digit)));
}

function isBareYearTitle(value) {
  return /^\p{Decimal_Number}{3,4}$/u.test(cleanText(value) || "");
}

function slugNeedsTitleRepair(source) {
  if (!isBareYearTitle(source.raw_title)) return false;
  const slug = cleanText(source.url)?.match(/\/book\/\d+\/([^/?#]+)/i)?.[1] || "";
  return Boolean(slug) && slug !== asciiDigits(source.raw_title);
}

function quotedTitleFromNotes(notes) {
  const text = cleanText(notes);
  if (!text) return null;
  const quoted = text.match(/[“"]([^”"]*?\p{Decimal_Number}{3,4}\s*[:：][^”"]{2,120})[”"]/u)?.[1];
  return cleanText(quoted);
}

function titleFromRokomariPageTitle(pageTitle, rawAuthor) {
  const cleaned = cleanText(decodeHtmlEntities(pageTitle))?.replace(/\s*\|\s*Rokomari\.com\s*$/i, "");
  if (!cleaned) return null;
  const banglaSide = cleanText(cleaned.split(/\s+-\s+/)[0]);
  if (!banglaSide) return null;

  const authorKey = normalizedKey(rawAuthor);
  if (!authorKey) return banglaSide;

  const parts = banglaSide.split(/\s*[:：]\s*/);
  if (parts.length > 2 && normalizedKey(parts.at(-1)) === authorKey) {
    return cleanText(parts.slice(0, -1).join(": "));
  }
  return banglaSide;
}

async function fetchPageTitle(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 boi-dataset-repair",
      connection: "close"
    }
  });
  if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
  const html = await response.text();
  return cleanText(decodeHtmlEntities(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]));
}

async function main() {
  const sources = readJsonl(paths.sources);
  const works = readJsonl(paths.works);
  const worksBySource = new Map();

  for (const work of works) {
    for (const sourceId of work.source_refs || []) {
      const list = worksBySource.get(sourceId) || [];
      list.push(work);
      worksBySource.set(sourceId, list);
    }
  }

  const changed = [];
  for (const source of sources) {
    if (source.source !== "RokomariBG book record" || !slugNeedsTitleRepair(source)) continue;

    let repairedTitle = quotedTitleFromNotes(source.notes);
    if (!repairedTitle) {
      try {
        repairedTitle = titleFromRokomariPageTitle(await fetchPageTitle(source.url), source.raw_author);
      } catch (error) {
        source.notes = cleanText(`${source.notes || ""} Title repair fetch failed: ${error.message}`);
      }
    }

    if (!repairedTitle || repairedTitle === source.raw_title || !/\p{Decimal_Number}{3,4}.*[:：]/u.test(repairedTitle)) {
      continue;
    }

    const previousTitle = source.raw_title;
    source.raw_title = repairedTitle;
    source.notes = cleanText(`${source.notes || ""} Title normalized from Rokomari page title/description; previous raw title: ${previousTitle}.`);

    for (const work of worksBySource.get(source.id) || []) {
      if (work.title_bn === previousTitle) {
        work.title_bn = repairedTitle;
        work.aliases = Array.from(new Set([...(work.aliases || []), previousTitle].filter(Boolean)));
        changed.push({ work_id: work.id, source_id: source.id, previous_title: previousTitle, repaired_title: repairedTitle });
      }
    }
  }

  writeJsonl(paths.sources, sources);
  writeJsonl(paths.works, works);
  console.log(JSON.stringify({ repaired: changed.length, changes: changed }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
