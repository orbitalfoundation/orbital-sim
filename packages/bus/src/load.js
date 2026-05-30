// load — manifest loader for the orbital bus.
//
// Responds to: { load: 'path/to/manifest.js' }
//          or: { load: ['path1.js', 'path2.js'] }
//
// For each named export in the manifest:
//   - entries with a resolve function (after inherits resolution) are registered as agents
//   - all other entries are dispatched as bus events — component handlers process them

import { pathToFileURL } from 'node:url';
import { resolve as resolvePath, dirname, isAbsolute } from 'node:path';
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
  // @todo may be better to mutate the source rather than clone — see design notes
  if (defaultId && !value.id && !value.name) value = { ...value, id: defaultId };
  out.push(value);
}

async function doLoad(manifestPath, bus) {
  const abs = isAbsolute(manifestPath)
    ? manifestPath
    : resolvePath(process.cwd(), manifestPath);

  const mod = await import(pathToFileURL(abs).href);
  const baseDir = dirname(abs);

  // @todo arrays are unrolled here; harmless but not strictly necessary
  const entries = [];
  for (const [name, value] of Object.entries(mod)) {
    if (name === 'default') pushFlat(entries, value);
    else pushFlat(entries, value, name);
  }

  // @todo inherited base files could be cached once per bus — minor optimisation
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

  return { agents: registered, manifestPath: abs };
}

export const manifestLoader = {
  id: 'bus.manifest-loader',

  resolve: async function(event, bus) {
    // handle { load: 'path' } or { load: ['path1', 'path2'] }
    if (typeof event.load !== 'string' && !Array.isArray(event.load)) return;

    const paths = Array.isArray(event.load) ? event.load : [event.load];
    let result;
    for (const path of paths) {
      result = await doLoad(path, bus);
    }
    return result;
  },
};
