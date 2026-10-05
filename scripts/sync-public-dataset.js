const fs = require('node:fs');
const path = require('node:path');

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, 'dataset', 'main', 'generated', 'exports');
const targetDir = path.join(rootDir, 'public', 'dataset-assets', 'exports');

if (!fs.existsSync(sourceDir)) {
  console.error(
    [
      '',
      'ERROR: dataset exports not found: dataset/main/generated/exports',
      'sync-public-dataset cannot populate public/dataset-assets/exports - refusing to build/sync with missing data (the /dataset page would serve a blank dataset).',
      '',
      'fix, then re-run:',
      '  1. restore dataset/main/ (gitignored - never in git)',
      '  2. pnpm dataset:export',
      '',
    ].join('\n')
  );
  process.exit(1);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Synced dataset exports to ${path.relative(rootDir, targetDir)}`);
