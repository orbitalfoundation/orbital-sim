// load — read a manifest file, route entries by `kind`:
//   - kind: 'agent' (default if `ref` or `resolve` is present) — registered as a resolver
//   - kind: 'asset' — recorded in sim.scenario.assets; available via sim.scenario.assetPath(name)
//
// Also installs `sim.scenario` with:
//   - dir              absolute path to the manifest's directory
//   - dataDir          absolute path to <dir>/.data (where fetched assets live)
//   - meta             scenario metadata (from manifest's `meta` export)
//   - assets           Map<name, asset entry>
//   - assetPath(name)  -> absolute path inside dataDir, or throws if undeclared
//   - hasAsset(name)   -> boolean (fast stat)
//   - requireAsset(n)  -> absolute path, throws with fetch hint if missing on disk
//
// Manifest conventions:
//   - file is JS (ESM); JSON support deferred
//   - every NAMED export is treated as an entry (or array of them)
//   - default export is also accepted; if array, flattened
//   - reserved top-level export name `meta` is scenario metadata, not an entry

import { pathToFileURL } from 'node:url';
import { resolve as resolvePath, dirname, isAbsolute, join, relative } from 'node:path';
import { statSync } from 'node:fs';

const RESERVED_EXPORTS = new Set(['meta']);

export async function loadManifest(sim, manifestPath) {
  const abs = isAbsolute(manifestPath) ? manifestPath : resolvePath(process.cwd(), manifestPath);
  const url = pathToFileURL(abs).href;
  const mod = await import(url);
  const baseDir = dirname(abs);
  const meta = mod.meta || {};

  const entries = [];
  for (const [name, value] of Object.entries(mod)) {
    if (RESERVED_EXPORTS.has(name)) continue;
    if (name === 'default') pushFlat(entries, value);
    else pushFlat(entries, value, name);
  }

  // Install sim.scenario before any agent runs so handlers can use it.
  const scenario = createScenario({ dir: baseDir, manifestPath: abs, meta });
  sim.scenario = scenario;

  const registered = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const kind = entry.kind || (entry.ref || typeof entry.resolve === 'function' ? 'agent' : null);
    if (kind === 'asset') {
      if (!entry.name) {
        console.warn(`[sim-core] asset entry missing 'name'; skipping`, entry);
        continue;
      }
      scenario.assets.set(entry.name, entry);
      continue;
    }
    if (kind !== 'agent') continue; // unknown kinds: ignored for forward-compat
    const agent = await resolveAgent(entry, baseDir);
    if (!agent) continue;
    sim.register(agent);
    registered.push(agent);
  }

  sim.resolve({
    load: 'manifest',
    manifest: abs,
    meta,
    count: registered.length,
    assets: scenario.assets.size,
  });

  return { meta, agents: registered, manifestPath: abs, scenario };
}

function createScenario({ dir, manifestPath, meta }) {
  const dataDir = join(dir, '.data');
  const assets = new Map();

  function assetPath(name) {
    const a = assets.get(name);
    if (!a) {
      throw new Error(
        `[sim-core] no asset named '${name}' declared in manifest ${relative(process.cwd(), manifestPath)}`
      );
    }
    return join(dataDir, a.target || name);
  }
  function hasAsset(name) {
    if (!assets.has(name)) return false;
    try { statSync(assetPath(name)); return true; } catch { return false; }
  }
  function requireAsset(name) {
    const p = assetPath(name);
    try { statSync(p); return p; }
    catch {
      const rel = relative(process.cwd(), manifestPath);
      const scenarioDir = relative(process.cwd(), dir);
      throw new Error(
        `[sim-core] missing asset '${name}' for ${rel}\n` +
        `  expected at: ${p}\n` +
        `  run: node scripts/fetch-data.mjs ${scenarioDir}`
      );
    }
  }

  return { dir, dataDir, manifestPath, meta, assets, assetPath, hasAsset, requireAsset };
}

function pushFlat(out, value, defaultId) {
  if (value == null) return;
  if (Array.isArray(value)) { for (const v of value) pushFlat(out, v); return; }
  if (typeof value !== 'object') return;
  if (defaultId && !value.id && !value.name) value = { ...value, id: defaultId };
  out.push(value);
}

async function resolveAgent(entry, baseDir) {
  if (!entry.ref) return entry;
  const spec = entry.ref;
  const importTarget = isImportSpecifier(spec)
    ? spec
    : pathToFileURL(resolvePath(baseDir, spec)).href;
  const mod = await import(importTarget);
  const template = mod.default ?? mod;
  return { ...template, ...entry };
}

function isImportSpecifier(s) {
  return /^(https?:|file:|node:|[a-z@][\w@\-./]*$)/i.test(s)
    && !s.startsWith('./') && !s.startsWith('../') && !s.startsWith('/');
}
