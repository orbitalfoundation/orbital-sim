// areas — filesystem queries over the public/ directory.
// No database; state is read live from the directory tree.

import { readdir, access, readFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { constants } from 'node:fs';

export function makeAreas(publicRoot) {
  async function exists(p) {
    try { await access(p, constants.F_OK); return true; } catch { return false; }
  }

  async function listArea(name) {
    const areaPath = join(publicRoot, name);
    if (!await exists(areaPath)) return null;
    const entries = await readdir(areaPath, { withFileTypes: true });
    const projects = await Promise.all(
      entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .map(async e => ({
          name:     e.name,
          hasIndex: await exists(join(areaPath, e.name, 'index.html')),
        }))
    );
    return projects;
  }

  async function projectInfo(area, project) {
    const base = join(publicRoot, area, project);
    if (!await exists(base)) return null;
    const hasIndex   = await exists(join(base, 'index.html'));
    const hasManifest = await exists(join(base, 'manifest.js'));
    let readme = null;
    for (const name of ['README.md', 'readme.md']) {
      const p = join(base, name);
      if (await exists(p)) { readme = await readFile(p, 'utf8'); break; }
    }
    return { hasIndex, hasManifest, readme };
  }

  async function createProject(area, project) {
    const base = join(publicRoot, area, project);
    if (await exists(base)) throw new Error('already exists');
    await mkdir(base, { recursive: true });
  }

  return { listArea, projectInfo, createProject };
}
