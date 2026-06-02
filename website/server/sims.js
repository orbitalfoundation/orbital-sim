// sims — bus instance lifecycle, ported from packages/server.
// Thin bridge: creates bus instances, emits tick events, no domain knowledge.

import { createBus } from '@orbital/bus';
import { EventEmitter } from 'node:events';

export const simEvents = new EventEmitter();
const sims = new Map();

export async function startSim(manifestPath, { hz = 1, dt = 3600 } = {}) {
  const id = crypto.randomUUID();
  const bus = createBus();

  bus.register({
    id: 'server.tap',
    resolve(event) {
      if (!event.tick) return;
      simEvents.emit('tick', { id, tick: event.tick, t: event.t, dt: event.dt });
    },
  });

  await bus.resolve({ load: manifestPath });
  const runner = await bus.resolve({ run: 'realtime', hz, dt });

  const entry = { id, bus, manifestPath, runner, hz, dt, startedAt: Date.now() };
  sims.set(id, entry);
  return entry;
}

export function stopSim(id) {
  const sim = sims.get(id);
  if (!sim) return false;
  sim.runner?.stop?.();
  sims.delete(id);
  simEvents.emit('stopped', { id });
  return true;
}

export function getSim(id)  { return sims.get(id); }
export function listSims()  {
  return [...sims.values()].map(({ id, manifestPath, hz, dt, startedAt }) =>
    ({ id, manifestPath, hz, dt, startedAt }));
}
