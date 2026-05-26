// sim-core — minimal pub/sub kernel + manifest loader for agent simulations.
//
// Usage:
//   import { createSim, loadManifest, runTicks } from 'sim-core'
//   const sim = createSim()
//   await loadManifest(sim, '/abs/path/to/manifest.js')
//   runTicks(sim, { ticks: 10, dt: 3600 })

export { createSim } from './lib/sys.js';
export { loadManifest } from './lib/load.js';
export { runTicks, startTicker } from './lib/tick.js';
