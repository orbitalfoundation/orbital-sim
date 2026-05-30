#!/usr/bin/env node
// Copy the hand-built seed components from public/shared/schema-components/
// into data/components/ so they're visible alongside derived ones.
// Idempotent: existing local files are NEVER overwritten.
//
// Usage:
//   npm run seed           # copy missing seeds
//   npm run seed -- --force  # overwrite local copies with seed versions

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ensureDirs, PATHS, writeComponent } from '../lib/storage.js';
import { parseArgs } from '../lib/args.js';
import { log } from '../lib/log.js';

const args = parseArgs();
await ensureDirs();

const entries = await fs.readdir(PATHS.seedComponents, { withFileTypes: true }).catch(() => []);
if (!entries.length) {
  log.warn(`no seeds found at ${PATHS.seedComponents}`); process.exit(0);
}

let copied = 0, skipped = 0;
for (const e of entries) {
  if (!e.isDirectory()) continue;
  const infoPath = path.join(PATHS.seedComponents, e.name, 'info.json');
  const raw = await fs.readFile(infoPath, 'utf8').catch(() => null);
  if (!raw) continue;

  const obj = JSON.parse(raw);
  const name = obj?.components?.schema?.componentName
            || obj?.components?.meta?.label
            || e.name;

  const safe = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const dest = path.join(PATHS.components, `${safe}.json`);
  const exists = await fs.access(dest).then(() => true).catch(() => false);

  if (exists && !args.force) {
    log.debug(`skip ${name} (already present)`); skipped++; continue;
  }

  obj._seed = true;
  obj._provenance = obj._provenance || { source: 'public/shared/schema-components', name: e.name };
  await writeComponent(name, obj);
  log.ok(`${exists ? '~' : '+'} ${name}`);
  copied++;
}

log.info(`seeded ${copied} component${copied === 1 ? '' : 's'}, skipped ${skipped}`);
