#!/usr/bin/env node
// fetch-data — pull external assets declared in scenario manifests.
//
// Usage:
//   node scripts/fetch-data.mjs                       # discover all public/*/*/manifest.js
//   node scripts/fetch-data.mjs public/anselm/tuvalu
//   node scripts/fetch-data.mjs path/to/manifest.js
//   node scripts/fetch-data.mjs --verify              # checksum existing files
//   node scripts/fetch-data.mjs --list                # list declared assets
//   node scripts/fetch-data.mjs --force               # re-download even if present
//
// Idempotent: skips files whose sha256 already matches.
//
// NOTE: assets are only auto-fetchable if the manifest declares both a `url`
// and `sha256` on the asset component. Local-path-only references (e.g. the
// GEBCO elevation raster) cannot be auto-fetched — use scripts/sync-data.sh
// to push those from your local machine to the remote server.

import { readdir, mkdir, stat, rename } from 'node:fs/promises';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, relative } from 'node:path';
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

async function fileSize(p) {
  try { return (await stat(p)).size; } catch { return null; }
}

function fmtBytes(n) {
  if (n == null) return '?';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

async function sha256File(path) {
  const h = createHash('sha256');
  await pipeline(createReadStream(path), h);
  return h.digest('hex');
}

async function fetchWithProgress(url, dest) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const total = Number(res.headers.get('content-length')) || null;
  let received = 0;
  let lastPct = -1;

  await mkdir(dirname(dest), { recursive: true });
  const tmp = dest + '.partial';
  const out = createWriteStream(tmp);

  for await (const chunk of res.body) {
    received += chunk.length;
    out.write(chunk);
    if (total) {
      const pct = Math.floor((received / total) * 100);
      if (pct !== lastPct && pct % 10 === 0) {
        process.stdout.write(`\r    ${fmtBytes(received)} / ${fmtBytes(total)} (${pct}%)`);
        lastPct = pct;
      }
    } else if (received % (1024 * 1024) < chunk.length) {
      process.stdout.write(`\r    ${fmtBytes(received)} received…`);
    }
  }
  out.end();
  await new Promise(r => out.on('finish', r));
  if (total || received > 0) process.stdout.write('\n');

  await rename(tmp, dest);
}

async function discoverManifests() {
  const out = [];
  if (!existsSync(PUBLIC_DIR)) return out;
  for (const user of await readdir(PUBLIC_DIR, { withFileTypes: true })) {
    if (!user.isDirectory() || user.name.startsWith('.')) continue;
    const userDir = join(PUBLIC_DIR, user.name);
    for (const scen of await readdir(userDir, { withFileTypes: true })) {
      if (!scen.isDirectory()) continue;
      const m = join(userDir, scen.name, 'manifest.js');
      if (existsSync(m)) out.push(m);
    }
  }
  return out;
}

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

function isAssetComponent(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj)
    && (obj.url || obj.target)
    && Object.prototype.hasOwnProperty.call(obj, 'sha256');
}

// Detect local-path-only references that can't be auto-fetched.
function isLocalPathRef(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj)
    && (obj.path || obj.target)
    && !obj.url && !obj.sha256;
}

async function readManifestAssets(manifestPath) {
  const mod = await import(pathToFileURL(manifestPath).href);
  const assets = [];
  const localRefs = [];
  for (const [exportName, value] of Object.entries(mod)) {
    if (exportName === 'default') continue;
    const items = Array.isArray(value) ? value : [value];
    for (const v of items) {
      if (!v || typeof v !== 'object') continue;
      for (const [compName, comp] of Object.entries(v)) {
        if (isAssetComponent(comp)) {
          assets.push({ ...comp, _entity: exportName, _component: compName });
        } else if (isLocalPathRef(comp) && (compName === 'elevation' || comp.path)) {
          localRefs.push({ _entity: exportName, _component: compName, path: comp.path ?? comp.target });
        }
      }
    }
  }
  return { dir: dirname(manifestPath), assets, localRefs };
}

async function processManifest(manifestPath, opts, stats) {
  const { dir, assets, localRefs } = await readManifestAssets(manifestPath);
  const rel = relative(process.cwd(), manifestPath);

  if (!assets.length && !localRefs.length) return;

  console.log(`\n  ${rel}`);

  // Warn about local-path references that can't be auto-fetched.
  for (const r of localRefs) {
    const have = r.path && await exists(resolve(ROOT, r.path));
    const sizeStr = have ? `  [${fmtBytes(await fileSize(resolve(ROOT, r.path)))}]` : '  [MISSING]';
    console.log(`    ${`${r._entity}.${r._component}`.padEnd(28)} local path: ${r.path}${sizeStr}`);
    if (!have) {
      // Give specific guidance for the GEBCO raster — the most common missing file.
      const isGebcoRaster = r.path?.includes('elevation') && r.path?.endsWith('.i16');
      const isGebcoTiles  = r.path?.includes('gebco');
      if (isGebcoRaster) {
        console.log(`      → generated from GEBCO 2026 tiles. To create it:`);
        console.log(`        bash scripts/fetch-gebco.sh        # ~3 GB download, extracts tiles`);
        console.log(`        node scripts/gebco-downsample.mjs  # generates the 18 MB raster`);
        console.log(`        bash scripts/sync-data.sh          # push to remote server`);
      } else if (isGebcoTiles) {
        console.log(`      → bash scripts/fetch-gebco.sh`);
      } else {
        console.log(`      → not auto-fetchable; run: bash scripts/sync-data.sh`);
      }
      stats.localMissing++;
    } else {
      stats.localPresent++;
    }
  }

  if (!assets.length) return;

  for (const a of assets) {
    const label = `${a._entity}.${a._component}`;
    // path takes precedence over target; both are resolved relative to repo root
    const dest = (a.path || a.target)
      ? resolve(ROOT, a.path ?? a.target)
      : join(dir, '.data', a._entity);
    const have = await exists(dest);

    stats.total++;

    if (opts.list) {
      const sizeStr = have ? `  [${fmtBytes(await fileSize(dest))}]` : '';
      console.log(`    ${label.padEnd(28)} → ${relative(process.cwd(), dest)}${sizeStr}${have ? '' : '  (missing)'}`);
      continue;
    }

    if (opts.verify) {
      if (!have) { console.log(`    MISSING   ${label}`); stats.missing++; continue; }
      if (!a.sha256) { console.log(`    SKIP      ${label}  (no sha256 in manifest)`); stats.skipped++; continue; }
      process.stdout.write(`    checking  ${label}… `);
      const sum = await sha256File(dest);
      const ok = sum === a.sha256;
      console.log(ok ? 'ok' : `MISMATCH\n      expected ${a.sha256}\n      got      ${sum}`);
      if (ok) stats.verified++; else stats.mismatched++;
      continue;
    }

    if (have && !opts.force) {
      if (a.sha256) {
        process.stdout.write(`    checking  ${label}… `);
        const sum = await sha256File(dest);
        if (sum === a.sha256) {
          console.log(`ok  [${fmtBytes(await fileSize(dest))}]`);
          stats.skipped++;
          continue;
        }
        console.log(`stale — re-fetching`);
      } else {
        console.log(`    have      ${label}  [${fmtBytes(await fileSize(dest))}]  (no sha256; --force to redownload)`);
        stats.skipped++;
        continue;
      }
    }

    if (!a.url || a.status === 'placeholder') {
      console.log(`    SKIP      ${label}: no url — add url + sha256 to manifest`);
      stats.skipped++;
      continue;
    }

    console.log(`    fetching  ${label}`);
    console.log(`      from: ${a.url}`);
    console.log(`      to:   ${relative(process.cwd(), dest)}`);
    try {
      await fetchWithProgress(a.url, dest);
      const size = await fileSize(dest);
      if (a.sha256) {
        process.stdout.write(`    verifying checksum… `);
        const sum = await sha256File(dest);
        if (sum !== a.sha256) {
          console.log(`MISMATCH\n      expected ${a.sha256}\n      got      ${sum}`);
          process.exitCode = 3;
          stats.mismatched++;
          continue;
        }
        console.log(`ok`);
      }
      console.log(`    done  [${fmtBytes(size)}]`);
      stats.fetched++;
    } catch (err) {
      console.error(`    FAILED: ${err.message}`);
      process.exitCode = 1;
      stats.failed++;
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`fetch-data: pull external assets declared in scenario manifests.

usage:
  node scripts/fetch-data.mjs [target...] [--verify|--list|--force]

targets:
  (none)              scan all public/*/*/manifest.js
  path/to/scenario    directory containing manifest.js
  path/to/manifest.js explicit manifest file

flags:
  --list    show declared assets and whether they exist locally
  --verify  checksum existing files against declared sha256
  --force   re-download even if the file is already present

assets must declare both url and sha256 to be auto-fetched.
local-path-only assets (e.g. GEBCO raster) cannot be auto-fetched —
use scripts/sync-data.sh to push them from your local machine.
`);
    return;
  }

  const mode = args.verify ? 'verify' : args.list ? 'list' : 'fetch';
  const stats = { total: 0, fetched: 0, skipped: 0, verified: 0,
                  missing: 0, mismatched: 0, failed: 0, localPresent: 0, localMissing: 0 };

  let manifests = [];
  if (args.targets.length === 0) {
    process.stdout.write(`Scanning ${relative(process.cwd(), PUBLIC_DIR)}/ for manifests… `);
    manifests = await discoverManifests();
    console.log(`found ${manifests.length}`);
  } else {
    for (const t of args.targets) {
      const found = await resolveTarget(t);
      if (!found.length) { console.error(`no manifest at: ${t}`); process.exitCode = 2; continue; }
      manifests.push(...found);
    }
    console.log(`${manifests.length} manifest(s) specified`);
  }

  if (!manifests.length) {
    console.log('nothing to do.');
    return;
  }

  console.log(`mode: ${mode}`);

  for (const m of manifests) await processManifest(m, args, stats);

  // Summary
  console.log('');
  if (mode === 'fetch') {
    const localStr = (stats.localPresent + stats.localMissing) > 0
      ? `  |  local-path: ${stats.localPresent} present  ${stats.localMissing} missing`
      : '';
    console.log(`done.  ${stats.fetched} fetched  ${stats.skipped} already present  ${stats.failed} failed${localStr}`);
    if (stats.localMissing > 0) {
      console.log(`       run: bash scripts/sync-data.sh  (or see website/README.md § Scenario data)`);
    }
  } else if (mode === 'verify') {
    console.log(`done.  ${stats.verified} ok  ${stats.mismatched} mismatched  ${stats.missing} missing`);
  } else {
    console.log(`done.  ${stats.total} asset(s) listed`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
