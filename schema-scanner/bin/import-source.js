#!/usr/bin/env node
// Import arbitrary JSON (or .txt) files as sources.
//
// - JSON object        -> one source file
// - JSON array         -> one source file per element
// - .txt file          -> one source file with `text`
//
// The original structured payload is preserved under `data`, and a
// human-readable `text` representation is synthesised so the entity
// extractor (which reads `text`) can consume it directly.
//
// Usage:
//   npm run import -- path/to/file.json
//   npm run import -- path/to/file.json --kind dive-site --prefix dives
//   npm run import -- path/to/file.txt  --kind note

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ensureDirs, writeSource, timestampId } from '../lib/storage.js';
import { parseArgs } from '../lib/args.js';
import { log } from '../lib/log.js';

const args = parseArgs();
const file = args._[0];
if (!file) {
  console.error('usage: npm run import -- <file> [--kind <k>] [--prefix <slug>]');
  process.exit(1);
}

await ensureDirs();

const abs = path.resolve(file);
const raw = await fs.readFile(abs, 'utf8');
const ext = path.extname(abs).toLowerCase();
const baseName = path.basename(abs, ext);
const kind   = args.kind   || (ext === '.txt' ? 'text' : 'record');
const prefix = args.prefix || baseName;

let records;
if (ext === '.txt') {
  records = [{ text: raw }];
} else {
  records = [parseLenient(raw)].flat();
}

let written = 0;
for (const rec of records) {
  if (rec == null) continue;
  const slug = pickSlug(rec, prefix);
  const id = timestampId(slug);
  const text = rec.text && typeof rec.text === 'string'
    ? rec.text
    : flatten(rec);

  await writeSource(id, {
    id,
    kind,
    imported_from: path.relative(process.cwd(), abs),
    imported_at: new Date().toISOString(),
    text,
    data: ext === '.txt' ? undefined : rec
  });
  log.ok(`+ data/sources/${id}.json`);
  written++;
}

log.info(`imported ${written} record${written === 1 ? '' : 's'}`);

// ---- helpers ----

// Tolerate trailing commas and stray leading whitespace; if it's still not
// valid, surface a useful error.
function parseLenient(s) {
  const cleaned = s.trim().replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(cleaned); }
  catch (e) { throw new Error(`Could not parse JSON (${e.message}). First 200 chars: ${cleaned.slice(0, 200)}`); }
}

function pickSlug(rec, fallback) {
  for (const k of ['id', 'slug', 'name', 'title']) {
    if (typeof rec?.[k] === 'string' && rec[k].trim()) return `${fallback}-${rec[k]}`;
  }
  return fallback;
}

// Render a structured record as readable prose-ish text so an LLM can
// extract entities from it. Strings, numbers, arrays, and shallow objects
// all become "key: value" lines; descriptions/blurbs are emitted verbatim.
function flatten(rec, indent = '') {
  const lines = [];
  for (const [k, v] of Object.entries(rec)) {
    if (v == null || v === '') continue;
    if (typeof v === 'string') {
      lines.push(`${indent}${k}: ${v}`);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      lines.push(`${indent}${k}: ${v}`);
    } else if (Array.isArray(v)) {
      if (v.every(x => typeof x === 'string' || typeof x === 'number')) {
        lines.push(`${indent}${k}: ${v.join(', ')}`);
      } else {
        lines.push(`${indent}${k}:`);
        for (const item of v) {
          if (item && typeof item === 'object') lines.push(flatten(item, indent + '  '));
          else lines.push(`${indent}  - ${item}`);
        }
      }
    } else if (typeof v === 'object') {
      lines.push(`${indent}${k}:`);
      lines.push(flatten(v, indent + '  '));
    }
  }
  return lines.join('\n');
}
