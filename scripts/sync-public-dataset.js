const fs = require('node:fs');
const path = require('node:path');

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, 'dataset', 'main', 'generated', 'exports');
const targetDir = path.join(rootDir, 'public', 'dataset-assets', 'exports');

if (!fs.existsSync(sourceDir)) {
  console.warn(`Dataset exports directory not found: ${sourceDir} — skipping sync`);
  process.exit(0);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Synced dataset exports to ${path.relative(rootDir, targetDir)}`);
