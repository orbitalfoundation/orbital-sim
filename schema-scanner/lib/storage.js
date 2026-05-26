// Filesystem-backed JSON store. One file per record. Boring on purpose.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA = path.join(ROOT, 'data');

export const PATHS = {
  sources:    path.join(DATA, 'sources'),
  entities:   path.join(DATA, 'entities'),
  components: path.join(DATA, 'components'),
  prototypes: path.join(DATA, 'prototypes'),
  // Read-only seed of hand-built components from the parent repo.
  seedComponents: path.resolve(ROOT, '..', 'public', 'shared', 'schema-components')
};

export async function ensureDirs() {
  for (const p of [PATHS.sources, PATHS.entities, PATHS.components, PATHS.prototypes]) {
    await fs.mkdir(p, { recursive: true });
  }
}

export function timestampId(slug = '') {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safe = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return safe ? `${ts}-${safe}` : ts;
}

async function readJson(file) {
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(file, obj) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

async function listDir(dir, ext = '.json') {
  try {
    const names = await fs.readdir(dir);
    return names.filter(n => n.endsWith(ext) && !n.startsWith('.')).sort();
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

// ---------- sources ----------

export async function listSources() {
  const json = await listDir(PATHS.sources, '.json');
  const txt  = await listDir(PATHS.sources, '.txt');
  return [...json, ...txt];
}

export async function readSource(name) {
  const file = path.join(PATHS.sources, name);
  if (name.endsWith('.txt')) {
    const text = await fs.readFile(file, 'utf8');
    return { id: name.replace(/\.txt$/, ''), kind: 'text', text };
  }
  const obj = await readJson(file);
  return { id: name.replace(/\.json$/, ''), ...obj };
}

export async function writeSource(id, record) {
  await writeJson(path.join(PATHS.sources, `${id}.json`), record);
  return id;
}

// ---------- entities ----------

export async function listEntityFiles() {
  return listDir(PATHS.entities);
}

export async function readEntities(sourceId) {
  try { return await readJson(path.join(PATHS.entities, `${sourceId}.json`)); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

export async function writeEntities(sourceId, record) {
  await writeJson(path.join(PATHS.entities, `${sourceId}.json`), record);
}

// ---------- components ----------

// Returns { name -> componentDefinition } merged from the seed dir + local dir.
// Local definitions win on name collision.
export async function loadAllComponents() {
  const out = {};
  for (const dir of [PATHS.seedComponents, PATHS.components]) {
    const entries = await safeReaddir(dir);
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat) continue;
      if (stat.isDirectory()) {
        // seed-style: <name>/info.json
        const info = path.join(full, 'info.json');
        const obj = await readJson(info).catch(() => null);
        if (obj) registerComponent(out, obj, full);
      } else if (entry.endsWith('.json') && !entry.startsWith('.')) {
        const obj = await readJson(full).catch(() => null);
        if (obj) registerComponent(out, obj, full);
      }
    }
  }
  return out;
}

function registerComponent(map, obj, sourcePath) {
  const name = obj?.components?.schema?.componentName
            || obj?.components?.meta?.label
            || path.basename(sourcePath, '.json');
  map[name] = { ...obj, _source: sourcePath };
}

async function safeReaddir(dir) {
  try { return await fs.readdir(dir); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}

export async function writeComponent(name, definition) {
  const safe = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await writeJson(path.join(PATHS.components, `${safe}.json`), definition);
  return safe;
}

// ---------- prototypes ----------

export async function loadAllPrototypes() {
  const out = {};
  const names = await listDir(PATHS.prototypes);
  for (const n of names) {
    if (n.startsWith('_')) continue; // skip _index.json and similar
    const obj = await readJson(path.join(PATHS.prototypes, n)).catch(() => null);
    if (!obj) continue;
    const slug = obj.slug?.split('/').pop() || n.replace(/\.json$/, '');
    out[slug] = obj;
  }
  return out;
}
