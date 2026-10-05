const fs = require('node:fs');
const path = require('node:path');

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, 'dataset', 'main', 'generated', 'exports');
const targetDir = path.join(rootDir, 'public', 'dataset-assets', 'exports');

if (!fs.existsSync(sourceDir)) {
  console.warn(
    [
      '',
      'WARN: dataset exports not found: dataset/main/generated/exports',
      'sync-public-dataset skipped populating public/dataset-assets/exports (gitignored in CI); /dataset will render DatasetExportError until exports are generated.',
      '',
    ].join('\n')
  );
  process.exit(0);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Synced dataset exports to ${path.relative(rootDir, targetDir)}`);
