#!/usr/bin/env node
// Deletes and recreates the Turso database for this dataset, then mints a fresh
// read-only and full-access database token.
//
//   TURSO_PLATFORM_TOKEN=... TURSO_ORG=<org-slug> node dataset/scripts/provision-dataset-db.mjs --yes
//
// Why delete + recreate instead of just re-uploading: Turso's /v1/upload endpoint
// only seeds a database that has no file yet (created with seed.type =
// "database_upload"), and an aborted upload leaves the database stuck with
// "Database upload already in progress" until it is deleted. So seeding is always
// provision -> upload in ONE shot (pnpm dataset:db:provision && pnpm dataset:db:upload),
// never a probe upload first.
//
// The database hostname stays the same across recreations; only the database id and
// the tokens change. The new tokens are written to
// dataset/main/generated/db/token.json (gitignored) and also have to be copied to
// .env.local, the vault item for this repo, and the Vercel project env vars.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const tokenPath = path.join(repoRoot, 'dataset', 'main', 'generated', 'db', 'token.json');

const ORG = process.env.TURSO_ORG;
const DATABASE = 'boi-dataset';
const GROUP = process.env.TURSO_GROUP ?? 'boi-mumbai';
const HOST = `${DATABASE}-${ORG}.aws-ap-south-1.turso.io`;
const API = `https://api.turso.tech/v1/organizations/${ORG}/databases`;

function fail(message) {
  console.error(`\nFATAL: ${message}\n`);
  process.exit(1);
}

const platformToken = process.env.TURSO_PLATFORM_TOKEN;
if (!platformToken) fail('TURSO_PLATFORM_TOKEN is not set (Turso platform API token, vault item app.turso.tech)');
if (!ORG) fail('TURSO_ORG is not set (Turso organization slug that owns the dataset database)');
if (!process.argv.includes('--yes')) fail(`this DELETES the live ${DATABASE} database; re-run with --yes to confirm`);

async function api(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${platformToken}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, ok: response.ok, json, text };
}

// 1. delete whatever is there now
const deleted = await api('DELETE', `${API}/${DATABASE}`);
if (deleted.ok) {
  console.log(`deleted ${DATABASE}`);
} else if (deleted.status === 404) {
  console.log(`${DATABASE} did not exist yet`);
} else {
  fail(`delete failed (HTTP ${deleted.status}): ${deleted.text.slice(0, 400)}`);
}

// 2. recreate with the seed that /v1/upload accepts
const created = await api('POST', API, { name: DATABASE, group: GROUP, seed: { type: 'database_upload' } });
if (!created.ok) fail(`create failed (HTTP ${created.status}): ${created.text.slice(0, 400)}`);
const database = created.json?.database ?? created.json ?? {};
console.log(`created ${database.name ?? DATABASE} (id ${database.DbId ?? database.db_id ?? 'unknown'}) in group ${GROUP}`);
if (!database.name) console.log(`  raw create response: ${created.text.slice(0, 300)}`);

// 3. mint fresh tokens
const readOnly = await api('POST', `${API}/${DATABASE}/auth/tokens?authorization=read-only`);
if (!readOnly.ok || !readOnly.json?.jwt) fail(`read-only token failed (HTTP ${readOnly.status}): ${readOnly.text.slice(0, 300)}`);
const fullAccess = await api('POST', `${API}/${DATABASE}/auth/tokens?authorization=full-access`);
if (!fullAccess.ok || !fullAccess.json?.jwt) fail(`full-access token failed (HTTP ${fullAccess.status}): ${fullAccess.text.slice(0, 300)}`);

fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
fs.writeFileSync(
  tokenPath,
  `${JSON.stringify(
    {
      host: HOST,
      url: `https://${HOST}`,
      read_only: readOnly.json.jwt,
      full_access: fullAccess.json.jwt,
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${path.relative(repoRoot, tokenPath)} (gitignored)`);
console.log('');
console.log('next steps:');
console.log('  1. upload the built file right away:');
console.log('       $token = (Get-Content dataset/main/generated/db/token.json | ConvertFrom-Json)');
console.log('       $env:TURSO_DATABASE_URL = $token.url; $env:TURSO_AUTH_TOKEN = $token.read_only');
console.log('       $env:TURSO_ADMIN_TOKEN = $token.full_access');
console.log('       pnpm dataset:db:upload');
console.log('  2. copy the read-only token into .env.local, the vault item for this repo, and the Vercel env vars');
