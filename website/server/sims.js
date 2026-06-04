// sims — bus instance lifecycle.
// Thin bridge: creates bus instances, taps observable state after each tick,
// streams frame buffers. No domain knowledge — just wiring.

import { createBus } from '@orbital/bus';
import { EventEmitter } from 'node:events';

export const simEvents = new EventEmitter();
const sims = new Map();

export async function startSim(manifestPath, { hz = 1, dt = 3600, maxTicks = null } = {}) {
  const id = crypto.randomUUID();
  const bus = createBus();

  let tickCount = 0;

  bus.register({
    id: 'server.tap',
    resolve(event, bus) {
      if (event.tick) {
        tickCount++;
        simEvents.emit('tick', {
          id,
          tick:   event.tick,
          t:      event.t,
          dt:     event.dt,
          year:   bus.atmosphere?.year?.()          ?? null,
          co2:    bus.atmosphere?.co2_ppm?.()        ?? null,
          deltaT: bus.atmosphere?.global_delta_t?.() ?? null,
        });
        // Auto-stop after maxTicks — deferred so the current tick completes first.
        if (maxTicks && tickCount >= maxTicks) {
          setImmediate(() => stopSim(id));
        }
      }

      if (event.frame) {
        simEvents.emit('frame', {
          id,
          year: event.frame.year,
          tick: event.frame.tick,
          buf:  event.frame.buf,
        });
      }
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
