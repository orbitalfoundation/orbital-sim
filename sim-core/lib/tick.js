// tick — opt-in driver. If no agent listens for `tick`, nothing runs.
//
// Two modes:
//   runTicks(sim, { ticks, dt })          — synchronous N-step loop
//   startTicker(sim, { hz, dt })          — wall-clock interval (returns stop fn)

export function runTicks(sim, { ticks = 1, dt = 1 } = {}) {
  for (let i = 0; i < ticks; i++) {
    sim.time = sim.time + dt;
    sim.resolve({ tick: i + 1, t: sim.time, dt });
  }
}

export function startTicker(sim, { hz = 30, dt = 1 / 30 } = {}) {
  let i = 0;
  const id = setInterval(() => {
    sim.time = sim.time + dt;
    sim.resolve({ tick: ++i, t: sim.time, dt });
  }, 1000 / hz);
  return () => clearInterval(id);
}
