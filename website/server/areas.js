// areas — info.json-driven view of the public/ namespace.
// The filesystem is the store; info.json in each directory is the manifest
// that declares what is visible and carries all metadata. Nothing is
// discovered by scanning — if it isn't in info.json, it doesn't exist
// from the web UI's perspective.

import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { constants } from 'node:fs';

export function makeAreas(publicRoot) {
  async function exists(p) {
    try { await access(p, constants.F_OK); return true; } catch { return false; }
  }

  async function readInfo(dirPath) {
    try {
      return JSON.parse(await readFile(join(dirPath, 'info.json'), 'utf8'));
    } catch {
      return null;
    }
  }

  // Returns the items array declared in an area's info.json, or null if not found.
  async function listArea(name) {
    const info = await readInfo(join(publicRoot, name));
    if (!info) return null;
    return info.items ?? [];
  }

  // Looks up a single item by slug within its area's info.json, then augments
  // it with filesystem-derived capabilities (hasIndex, hasManifest, readme).
  async function projectInfo(area, project) {
    const areaInfo = await readInfo(join(publicRoot, area));
    const item = areaInfo?.items?.find(i => i.slug === project) ?? null;
    if (!item) return null;

    const base = join(publicRoot, area, project);
    const hasIndex    = await exists(join(base, 'index.html'));
    const hasManifest = await exists(join(base, 'manifest.js'));

    let readme = null;
    for (const fname of ['README.md', 'readme.md']) {
      const p = join(base, fname);
      if (await exists(p)) { readme = await readFile(p, 'utf8'); break; }
    }

    return { ...item, hasIndex, hasManifest, readme };
  }

  // Resolves a ref path like "/anselm/tenerife-futures" by looking up the slug
  // in the parent area's info.json items array.
  async function resolveRef(ref) {
    const parts = ref.replace(/^\//, '').split('/');
    if (parts.length < 2) return null;
    const [area, slug] = parts;
    const areaInfo = await readInfo(join(publicRoot, area));
    const item = areaInfo?.items?.find(i => i.slug === slug) ?? null;
    return item ? { ...item, ref } : null;
  }

  // Returns the home feed from /public/info.json with all refs resolved.
  async function homeFeed() {
    const root = await readInfo(publicRoot);
    if (!root) return null;
    const feed = await Promise.all(
      (root.feed ?? []).map(async item => {
        if (!item.ref) return item;
        const resolved = await resolveRef(item.ref);
        // Feed item fields override resolved metadata (e.g. a hand-set date)
        return resolved ? { ...resolved, ...item } : item;
      })
    );
    return { ...root, feed };
  }

  async function createProject(area, project, meta = {}) {
    const base = join(publicRoot, area, project);
    if (await exists(base)) throw new Error('already exists');
    await mkdir(base, { recursive: true });

    // Add a stub entry to the area's info.json so the item is immediately visible.
    const areaPath = join(publicRoot, area);
    const existing = await readInfo(areaPath) ?? { title: area, items: [] };
    const items = existing.items ?? [];
    items.push({
      slug: project,
      type: meta.type ?? 'other',
      title: meta.title ?? project,
      ...(meta.description && { description: meta.description }),
      ...(meta.author      && { author: meta.author }),
    });
    await writeFile(
      join(areaPath, 'info.json'),
      JSON.stringify({ ...existing, items }, null, 2),
      'utf8',
    );
  }

  return { listArea, projectInfo, homeFeed, createProject };
}
