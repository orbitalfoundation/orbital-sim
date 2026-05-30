#!/usr/bin/env node
// Decompose extracted entities into ECS components.
// - Loads existing components from public/shared/schema-components AND data/components.
// - Asks Claude to map each entity to existing components, extending or
//   inventing only when necessary.
// - Writes invented components to data/components/<name>.json in the same
//   shape as the seed components.
// - Writes/updates per-source decompositions to data/entities/<sourceId>.json
//   under a `decomposition` key.
//
// Usage:
//   npm run derive                      # only sources without a decomposition
//   npm run derive -- --all
//   npm run derive -- --source <id>
//   npm run derive -- --batch 12        # entities per LLM call (default 10)

import 'dotenv/config';
import { complete } from '../lib/claude.js';
import { componentDecompositionPrompt } from '../lib/prompts.js';
import {
  ensureDirs, listEntityFiles, readEntities, writeEntities,
  loadAllComponents, writeComponent
} from '../lib/storage.js';
import { parseArgs } from '../lib/args.js';
import { log } from '../lib/log.js';

const args  = parseArgs();
const batch = Math.max(1, Number(args.batch) || 10);

await ensureDirs();

let files = await listEntityFiles();
if (args.source) {
  files = files.filter(f => f === `${args.source}.json` || f.startsWith(args.source));
  if (!files.length) { log.error(`no entity file matched ${args.source}`); process.exit(1); }
}

const components = await loadAllComponents();
log.info(`loaded ${Object.keys(components).length} existing components: ${Object.keys(components).join(', ') || '(none)'}`);

for (const file of files) {
  const sourceId = file.replace(/\.json$/, '');
  const record   = await readEntities(sourceId);
  if (!record?.entities?.length) { log.warn(`skip ${sourceId} (no entities)`); continue; }
  if (!args.all && !args.source && record.decomposition) {
    log.debug(`skip ${sourceId} (already decomposed)`); continue;
  }

  log.info(`decomposing ${record.entities.length} entities from ${sourceId}`);
  const allDecompositions = [];
  const allExtended = [];
  const allInvented = [];

  for (let i = 0; i < record.entities.length; i += batch) {
    const slice = record.entities.slice(i, i + batch);
    const { system, user } = componentDecompositionPrompt({
      entities: slice,
      components
    });
    const result = await complete({ system, user, temperature: 0.2, maxTokens: 4096, json: true });

    if (Array.isArray(result.entities)) allDecompositions.push(...result.entities);
    const changes = result.componentChanges || {};
    if (Array.isArray(changes.extended)) allExtended.push(...changes.extended);
    if (Array.isArray(changes.invented)) allInvented.push(...changes.invented);
  }

  // Apply invented components.
  for (const inv of allInvented) {
    if (!inv?.name || components[inv.name]) {
      log.debug(`skip invented (duplicate or invalid): ${inv?.name}`); continue;
    }
    const def = {
      slug: `/_schema/${inv.name}`,
      components: {
        meta: {
          label: inv.label || inv.name,
          content: inv.content || '',
          tags: ['schema', 'component', 'derived']
        },
        schema: {
          componentName: inv.name,
          fields: inv.fields || {}
        }
      },
      _provenance: { sourceId, rationale: inv.rationale || '' }
    };
    const slug = await writeComponent(inv.name, def);
    components[inv.name] = { ...def, _source: slug };
    log.ok(`+ component "${inv.name}" (${Object.keys(def.components.schema.fields).length} fields)`);
  }

  // Apply extensions: merge addFields into the existing component file.
  for (const ext of allExtended) {
    const target = components[ext?.name];
    if (!target || !ext.addFields) {
      log.warn(`skip extension for unknown component: ${ext?.name}`); continue;
    }
    target.components ??= {};
    target.components.schema ??= { componentName: ext.name, fields: {} };
    target.components.schema.fields ??= {};
    let added = 0;
    for (const [field, def] of Object.entries(ext.addFields)) {
      if (target.components.schema.fields[field]) continue;
      target.components.schema.fields[field] = { ...def, _addedBy: sourceId };
      added++;
    }
    if (added) {
      target._provenance = target._provenance || [];
      target._provenance.push({ sourceId, action: 'extend', rationale: ext.rationale || '' });
      // Always write extensions to the LOCAL components dir so we never
      // mutate the seed library in public/shared/schema-components.
      await writeComponent(ext.name, stripInternal(target));
      log.ok(`~ component "${ext.name}" extended (+${added} field${added === 1 ? '' : 's'})`);
    }
  }

  record.decomposition = {
    decomposed_at: new Date().toISOString(),
    entities: allDecompositions,
    componentChanges: { extended: allExtended, invented: allInvented }
  };
  await writeEntities(sourceId, record);
  log.ok(`wrote decomposition for ${sourceId} (${allDecompositions.length} entities)`);
}

function stripInternal(obj) {
  const clone = JSON.parse(JSON.stringify(obj));
  delete clone._source;
  return clone;
}
