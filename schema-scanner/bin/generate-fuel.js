#!/usr/bin/env node
// Generate a short piece of "real-world" prose with Claude.
// Usage:
//   npm run generate
//   npm run generate -- --topic "small-town port" --count 2

import 'dotenv/config';
import { complete } from '../lib/claude.js';
import { fuelPrompt } from '../lib/prompts.js';
import { ensureDirs, writeSource, timestampId } from '../lib/storage.js';
import { parseArgs } from '../lib/args.js';
import { log } from '../lib/log.js';

const args = parseArgs();
const topic = typeof args.topic === 'string' ? args.topic : null;
const count = Number(args.count) || 1;

await ensureDirs();

for (let i = 0; i < count; i++) {
  const { system, user } = fuelPrompt({ topic });
  log.info(`generating fuel ${i + 1}/${count}${topic ? ` (topic: ${topic})` : ''}`);
  const text = await complete({ system, user, temperature: 0.9, maxTokens: 1024 });

  const id = timestampId(topic || 'untopiced');
  await writeSource(id, {
    id,
    kind: 'story',
    topic,
    generated_at: new Date().toISOString(),
    text
  });
  log.ok(`wrote data/sources/${id}.json (${text.length} chars)`);
}
