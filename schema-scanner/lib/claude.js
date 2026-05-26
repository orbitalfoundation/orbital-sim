// Thin wrapper around the Anthropic Messages API using fetch.
// Keeps us free of the SDK so the project has near-zero deps.

import { log } from './log.js';

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';

export async function complete({
  system,
  user,
  model = DEFAULT_MODEL,
  maxTokens = 4096,
  temperature = 0.7,
  json = false
} = {}) {
  const apiKey = process.env.ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing — see .env.example');
  if (!user)   throw new Error('claude.complete: `user` is required');

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: user }]
  };
  if (system) body.system = system;

  log.debug('claude →', model, `(${user.length} chars)`);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': VERSION
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();

  log.debug('claude ←', `${text.length} chars`, data.usage || '');
  return json ? extractJson(text) : text;
}

// Pull out the first balanced JSON object/array in a model response.
// Tolerates ```json fences and surrounding prose.
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[\[{]/);
  if (start === -1) throw new Error(`No JSON found in response:\n${text}`);

  const open = candidate[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;

  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        const slice = candidate.slice(start, i + 1);
        try { return JSON.parse(slice); }
        catch (e) { throw new Error(`JSON parse failed: ${e.message}\n---\n${slice}`); }
      }
    }
  }
  throw new Error(`Unbalanced JSON in response:\n${text}`);
}
