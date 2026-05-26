#!/usr/bin/env node
// fetch-data — pull external assets declared in scenario manifests.
//
// Usage:
//   node scripts/fetch-data.mjs                       # discover all public/*/*/manifest.js
//   node scripts/fetch-data.mjs public/anselm/planetary
//   node scripts/fetch-data.mjs path/to/manifest.js
//   node scripts/fetch-data.mjs --verify              # checksum existing files
//   node scripts/fetch-data.mjs --list                # list declared assets
//   node scripts/fetch-data.mjs --force               # re-download even if present
//
// Idempotent: skips files whose sha256 already matches.

import { readdir, mkdir, stat, rename } from 'node:fs/promises';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, relative, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLIC_DIR = join(ROOT, 'public');

function parseArgs(argv) {
  const out = { targets: [], verify: false, list: false, force: false };
  for (const a of argv) {
    if (a === '--verify') out.verify = true;
    else if (a === '--list') out.list = true;
    else if (a === '--force') out.force = true;
    else if (a === '-h' || a === '--help') out.help = true;
    else if (!a.startsWith('-')) out.targets.push(a);
  }
  return out;
}

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

async function sha256File(path) {
  const h = createHash('sha256');
  await pipeline(createReadStream(path), h);
  return h.digest('hex');
}

async function fetchTo(url, dest) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  await mkdir(dirname(dest), { recursive: true });
  const tmp = dest + '.partial';
  await pipeline(res.body, createWriteStream(tmp));
  await rename(tmp, dest);
}

// Walk public/*/*/manifest.js (depth fixed at 2 for now: user/scenario)
async function discoverManifests() {
  const out = [];
  if (!existsSync(PUBLIC_DIR)) return out;
  for (const user of await readdir(PUBLIC_DIR, { withFileTypes: true })) {
    if (!user.isDirectory()) continue;
    const userDir = join(PUBLIC_DIR, user.name);
    for (const scen of await readdir(userDir, { withFileTypes: true })) {
      if (!scen.isDirectory()) continue;
      const m = join(userDir, scen.name, 'manifest.js');
      if (existsSync(m)) out.push(m);
    }
  }
  return out;
}

// Resolve a CLI target to one or more manifest paths.
async function resolveTarget(t) {
  const p = resolve(process.cwd(), t);
  const s = await stat(p).catch(() => null);
  if (s?.isFile() && p.endsWith('.js')) return [p];
  if (s?.isDirectory()) {
    const m = join(p, 'manifest.js');
    if (existsSync(m)) return [m];
  }
  return [];
}

// Lazily import a manifest and return { dir, assets[] }.
async function readManifestAssets(manifestPath) {
  const mod = await import(pathToFileURL(manifestPath).href);
  const assets = [];
  for (const [name, value] of Object.entries(mod)) {
    if (name === 'meta') continue;
    const items = Array.isArray(value) ? value : [value];
    for (const v of items) {
      if (v && typeof v === 'object' && v.kind === 'asset') assets.push(v);
    }
  }
  return { dir: dirname(manifestPath), assets };
}

async function processManifest(manifestPath, opts) {
  const { dir, assets } = await readManifestAssets(manifestPath);
  if (!assets.length) return { manifestPath, processed: 0 };
  const rel = relative(process.cwd(), manifestPath);
  console.log(`\n[${rel}]  ${assets.length} asset(s)`);

  const dataDir = join(dir, '.data');

  for (const a of assets) {
    if (!a.name) { console.warn(`  skip: asset missing name`); continue; }
    const dest = join(dataDir, a.target || a.name);
    const have = await exists(dest);

    if (opts.list) {
      console.log(`  ${a.name.padEnd(24)} -> ${relative(process.cwd(), dest)}${have ? '  [have]' : ''}`);
      continue;
    }

    if (opts.verify) {
      if (!have) { console.log(`  MISSING  ${a.name}`); continue; }
      if (!a.sha256) { console.log(`  SKIP     ${a.name} (no sha256)`); continue; }
      const sum = await sha256File(dest);
      console.log(`  ${sum === a.sha256 ? 'OK      ' : 'MISMATCH'} ${a.name}`);
      continue;
    }

    if (have && !opts.force) {
      if (a.sha256) {
        const sum = await sha256File(dest);
        if (sum === a.sha256) { console.log(`  have     ${a.name} (sha256 ok)`); continue; }
        console.log(`  stale    ${a.name} (sha256 mismatch; re-fetching)`);
      } else {
        console.log(`  have     ${a.name} (no sha256 to verify; use --force to redownload)`);
        continue;
      }
    }

    if (!a.url || a.status === 'placeholder') {
      console.error(`  SKIP     ${a.name}: placeholder/no url — fill in url + sha256 in ${rel}`);
      continue;
    }

    console.log(`  fetch    ${a.name} <- ${a.url}`);
    try {
      await fetchTo(a.url, dest);
      if (a.sha256) {
        const sum = await sha256File(dest);
        if (sum !== a.sha256) {
          console.error(`    sha256 mismatch! expected ${a.sha256}, got ${sum}`);
          process.exitCode = 3;
          continue;
        }
      }
      console.log(`    ok -> ${relative(process.cwd(), dest)}`);
    } catch (err) {
      console.error(`    failed: ${err.message}`);
      process.exitCode = 1;
    }
  }
  return { manifestPath, processed: assets.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`fetch-data: pull external assets declared in scenario manifests.

usage:
  node scripts/fetch-data.mjs [target...] [--verify|--list|--force]

targets:
  (none)                          discover all public/*/*/manifest.js
  path/to/scenario                directory containing manifest.js
  path/to/manifest.js             explicit manifest file
`);
    return;
  }

  let manifests = [];
  if (args.targets.length === 0) {
    manifests = await discoverManifests();
  } else {
    for (const t of args.targets) {
      const found = await resolveTarget(t);
      if (!found.length) { console.error(`no manifest at: ${t}`); process.exitCode = 2; continue; }
      manifests.push(...found);
    }
  }

  if (!manifests.length) {
    console.log('no manifests found.');
    return;
  }

  for (const m of manifests) await processManifest(m, args);
}

main().catch((err) => { console.error(err); process.exit(1); });
