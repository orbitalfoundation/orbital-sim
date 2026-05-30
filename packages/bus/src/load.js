// load — manifest loader for sim-core.
//
// The loader is a normal kernel resolver and responds to the event:
//   { load: 'manifest', manifest: '<path>' }
//
// When the manifest is loaded, the loader installs sim.scenario, registers
// agent resolvers, and emits a follow-up loaded event so newly registered
// handlers can respond.

import { pathToFileURL } from 'node:url';
import { resolve as resolvePath, dirname, isAbsolute, join, relative } from 'node:path';
import { statSync } from 'node:fs';

const RESERVED_EXPORTS = new Set(['meta']);

export const manifestLoader = {
  id: 'sim-core.manifest-loader',
  resolve: async function (event, sim) {
      if (event.load !== 'manifest' || event.loaded) return;
      if (!event.manifest) {
        console.error('[sim-core] load event missing manifest path', event);
        return;
      }

      const abs = resolveManifestPath(event.manifest);
      const { meta, registered, scenario } = await doLoadManifest(sim, abs);

      await sim.resolve({
        load: 'manifest',
        manifest: abs,
        meta,
        count: registered.length,
        assets: scenario.assets.size,
        loaded: true,
      });

      return { meta, agents: registered, manifestPath: abs, scenario };
  },
};

export async function loadManifest(sim, manifestPath) {
  const result = await sim.resolve({ load: 'manifest', manifest: manifestPath });
  return result;
}

function resolveManifestPath(manifestPath) {
  return isAbsolute(manifestPath) ? manifestPath : resolvePath(process.cwd(), manifestPath);
}

async function doLoadManifest(sim, abs) {
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
    if (kind !== 'agent') continue;
    const agent = await resolveAgent(entry, baseDir);
    if (!agent) continue;
    sim.register(agent);
    registered.push(agent);
  }

  return { meta, registered, scenario };
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
