// Smoke test: empty system + one tick-counting agent. No I/O.
//
// Run: node sim-core/test/smoke.js

import { createSim, runTicks } from '../index.js';

const sim = createSim();
let count = 0;

const counter = {
  id: 'counter',
  resolve(event) { if (event.tick) count++; },
};
counter.resolve.filter = { tick: true };

sim.register(counter);
runTicks(sim, { ticks: 5, dt: 1 });

if (count !== 5) {
  console.error(`FAIL: expected 5 ticks, got ${count}`);
  process.exit(1);
}
console.log(`OK: counter saw ${count} ticks`);
