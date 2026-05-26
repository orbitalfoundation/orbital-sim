#!/usr/bin/env node
// sim-core CLI.
//
// Usage:
//   node sim-core/bin/run.js <path-to-manifest.js> [--ticks N] [--dt SECONDS] [--t0 ISO_DATE]

import { createSim, loadManifest, runTicks } from '../index.js';

function parseFlags(argv) {
  const out = { ticks: 1, dt: 1, t0: 0 };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ticks') out.ticks = Number(argv[++i]);
    else if (a === '--dt') out.dt = Number(argv[++i]);
    else if (a === '--t0') out.t0 = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else positional.push(a);
  }
  out.manifest = positional[0];
  return out;
}

function printHelp() {
  console.log(`sim-core: minimal pub/sub simulation kernel

usage:
  node sim-core/bin/run.js <manifest.js> [options]

options:
  --ticks N      number of ticks to run (default 1)
  --dt SECONDS   simulated seconds per tick (default 1)
  --t0 ISO_DATE  starting time (ISO string or number)
  -h, --help     show this message
`);
}

async function main() {
  const opts = parseFlags(process.argv.slice(2));
  if (opts.help || !opts.manifest) { printHelp(); process.exit(opts.manifest ? 0 : 1); }

  const tStart = typeof opts.t0 === 'string' && opts.t0
    ? (isNaN(Date.parse(opts.t0)) ? Number(opts.t0) : new Date(opts.t0).getTime() / 1000)
    : Number(opts.t0) || 0;

  const sim = createSim({ tStart });
  const { meta, agents, manifestPath } = await loadManifest(sim, opts.manifest);

  console.error(`[sim-core] loaded ${agents.length} agent(s) from ${manifestPath}`);
  if (meta?.name) console.error(`[sim-core] scenario: ${meta.name}`);
  console.error(`[sim-core] running ${opts.ticks} tick(s), dt=${opts.dt}s`);

  runTicks(sim, { ticks: opts.ticks, dt: opts.dt });

  sim.resolve({ done: true });
}

main().catch((err) => {
  console.error('[sim-core] failed:', err);
  process.exit(1);
});
