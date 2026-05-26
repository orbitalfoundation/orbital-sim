#!/usr/bin/env node
// Extract entities (and lightweight relationships) from each source.
// Usage:
//   npm run extract                    # only sources without entity files
//   npm run extract -- --all
//   npm run extract -- --source <id>

import 'dotenv/config';
import { complete } from '../lib/claude.js';
import { entityExtractionPrompt } from '../lib/prompts.js';
import {
  ensureDirs, listSources, readSource,
  readEntities, writeEntities
} from '../lib/storage.js';
import { parseArgs } from '../lib/args.js';
import { log } from '../lib/log.js';

const args = parseArgs();
await ensureDirs();

let names = await listSources();
if (args.source) {
  names = names.filter(n => n.startsWith(args.source) || n === args.source || n === `${args.source}.json` || n === `${args.source}.txt`);
  if (!names.length) { log.error(`no source matched ${args.source}`); process.exit(1); }
}

let processed = 0;
for (const name of names) {
  const src = await readSource(name);
  if (!args.all && !args.source && (await readEntities(src.id))) {
    log.debug(`skip ${src.id} (already extracted)`); continue;
  }

  const text = src.text || src.body || '';
  const data = src.data && typeof src.data === 'object' ? src.data : null;
  if (!text.trim() && !data) { log.warn(`skip ${src.id} (no text or data)`); continue; }

  const { system, user } = entityExtractionPrompt({ text, data, kind: src.kind });
  log.info(`extracting entities from ${src.id}${data ? ' (structured)' : ''}`);
  const result = await complete({ system, user, temperature: 0.2, maxTokens: 4096, json: true });

  const record = {
    sourceId: src.id,
    extracted_at: new Date().toISOString(),
    entities: Array.isArray(result.entities) ? result.entities : [],
    relationships: Array.isArray(result.relationships) ? result.relationships : []
  };
  await writeEntities(src.id, record);
  log.ok(`wrote data/entities/${src.id}.json — ${record.entities.length} entities, ${record.relationships.length} relationships`);
  processed++;
}

log.info(`done — ${processed} source(s) processed`);
