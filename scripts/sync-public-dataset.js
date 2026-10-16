const fs = require('node:fs');
const path = require('node:path');

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, 'dataset', 'main', 'generated', 'exports');
const targetDir = path.join(rootDir, 'public', 'dataset-assets', 'exports');

// /dataset and /dataset/exports/* are served from the Turso database (see
// src/lib/dataset-db.ts), which is built from these exports by
// dataset/scripts/build-dataset-db.mjs. This build step only mirrors the small
// root export files so they stay reachable as plain static assets; the 2.7 GB
// paged grid stays in dataset/main and is never copied into public/.

if (!fs.existsSync(sourceDir)) {
  console.warn(
    [
      '',
      'WARN: dataset exports not found: dataset/main/generated/exports',
      'sync-public-dataset skipped (dataset/main is gitignored and absent in CI clones).',
      '/dataset reads the live dataset from the Turso database and does not depend on these files.',
      '',
    ].join('\n')
  );
  process.exit(0);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });

let copied = 0;
for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  fs.copyFileSync(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
  copied += 1;
}

console.log(
  `Synced ${copied} dataset export root files to ${path.relative(rootDir, targetDir)} (paged grid is served from the Turso database).`
);
