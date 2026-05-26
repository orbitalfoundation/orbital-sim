#!/usr/bin/env node
// Quick inventory of what's in data/.
import {
  ensureDirs, listSources, listEntityFiles,
  loadAllComponents, loadAllPrototypes, PATHS
} from '../lib/storage.js';
import path from 'node:path';

await ensureDirs();
const sources    = await listSources();
const entityFs   = await listEntityFiles();
const components = await loadAllComponents();
const prototypes = await loadAllPrototypes();

const fmt = (label, items) => {
  console.log(`\n${label} (${items.length})`);
  for (const it of items) console.log('  ' + it);
};

fmt('sources', sources);
fmt('entities', entityFs);

console.log(`\ncomponents (${Object.keys(components).length})`);
for (const [name, c] of Object.entries(components)) {
  const fields = c.components?.schema?.fields ? Object.keys(c.components.schema.fields) : [];
  const origin = c._seed ? 'seed'
               : c._source?.startsWith(PATHS.seedComponents) ? 'seed'
               : 'derived';
  console.log(`  ${name.padEnd(20)} [${origin.padEnd(7)}] ${fields.join(', ')}`);
}

console.log(`\nprototypes (${Object.keys(prototypes).length})`);
for (const [slug, p] of Object.entries(prototypes)) {
  console.log(`  ${slug.padEnd(20)} ${(p.components || []).join(' + ')}`);
}

const rel = p => path.relative(process.cwd(), p);
console.log(`\nroot: ${rel(PATHS.sources)}/  ${rel(PATHS.entities)}/  ${rel(PATHS.components)}/  ${rel(PATHS.prototypes)}/`);
