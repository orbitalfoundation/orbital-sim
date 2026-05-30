// load — manifest loader for the orbital bus.
//
// Responds to: { load: 'manifest', manifest: '<absolute-or-relative-path>' }
//
// For each named export in the manifest:
//   - entries with a resolve function (after inherits resolution) are registered as agents
//   - all other entries are dispatched as bus events — component handlers process them

import { pathToFileURL } from 'node:url';
import { resolve as resolvePath, dirname, isAbsolute, join } from 'node:path';
import logger from '@orbital/utils';

async function resolveInherits(entry, baseDir) {
  if (!entry.inherits) return entry;
  const spec = entry.inherits;
  const importTarget = isImportSpecifier(spec)
    ? spec
    : pathToFileURL(resolvePath(baseDir, spec)).href;
  let mod;
  try {
    mod = await import(importTarget);
  } catch (err) {
    logger.error(`[bus] failed to import '${spec}':`, err.message);
    return null;
  }
  const template = mod.default ?? mod;
  return { ...template, ...entry };
}

function isImportSpecifier(s) {
  return /^(https?:|file:|node:|[a-z@][\w@\-./]*$)/i.test(s)
    && !s.startsWith('./') && !s.startsWith('../') && !s.startsWith('/');
}

function pushFlat(out, value, defaultId) {
  if (value == null) return;
  if (Array.isArray(value)) { for (const v of value) pushFlat(out, v); return; }
  if (typeof value !== 'object') return;
  if (defaultId && !value.id && !value.name) value = { ...value, id: defaultId };
  out.push(value);
}

export const manifestLoader = {
  id: 'bus.manifest-loader',

  resolve: async function(event, bus) {

    // @todo it is unclear why something needs both event.load AND a manifest
    if (event.load !== 'manifest' || event.loaded) return;
    if (!event.manifest) {
      logger.error('[bus] load event missing manifest path');
      return;
    }

    const abs = isAbsolute(event.manifest)
      ? event.manifest
      : resolvePath(process.cwd(), event.manifest);

    const mod = await import(pathToFileURL(abs).href);
    const baseDir = dirname(abs);

    // @todo this line suggests a bus is handling only a single scenario at a time - a major design choice that requires thought
    bus.scenario = { dir: baseDir, dataDir: join(baseDir, '.data'), manifestPath: abs };

    // @todo i see that we're unrolling arrays here; it isn't absolutely critical to do that here - harmless however so we can leave it
    // @todo i see that we clone the values and decorate them with their own name/id - may be better to mutate the source
    const entries = [];
    for (const [name, value] of Object.entries(mod)) {
      if (name === 'default') pushFlat(entries, value);
      else pushFlat(entries, value, name);
    }

    // here we are doing inherit - @todo we could cache those inherited base files once
    // @todo i see we have a tendency to call bus.register directly; even though bus.resolve can do that
    const registered = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const resolved = await resolveInherits(entry, baseDir);
      if (!resolved) continue;

      if (typeof resolved.resolve === 'function') {
        bus.register(resolved);
        registered.push(resolved);
      } else {
        await bus.resolve(resolved);
      }
    }

    // @todo i see we call ourselves again with a more complete manifest ... hmmm. feels complicated.
    // @todo think about the idea of how a scenario is collected as a group
    await bus.resolve({ load: 'manifest', manifest: abs, count: registered.length, loaded: true });
    return { agents: registered, manifestPath: abs };
  },
};
