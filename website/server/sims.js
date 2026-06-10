// sims — per-session simulation bus lifecycle.
//
// Each client session maps to exactly one bus instance, started when the
// client calls POST /api/sim and loaded from a manifest. The bus holds the
// agents that session declared — simulation agents, ingestion agents, or both.
// Queries from the client are routed to their own session bus; if the agent
// isn't in their manifest the query returns null. No shared background buses.

import { createBus } from '@orbital/bus';
import { EventEmitter } from 'node:events';

export const simEvents = new EventEmitter();
const sims = new Map();

export async function startSim(manifestPath, { hz = 1, dt = 3600, maxTicks = null, init = {} } = {}) {
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
        if (maxTicks && tickCount >= maxTicks) {
          setImmediate(() => stopSim(id));
        }
      }

      if (event.frame) {
        simEvents.emit('frame', { id, year: event.frame.year, tick: event.frame.tick, buf: event.frame.buf });
      }

      // Generic observe: agents emit { observe: {...} } to report state.
      if (event.observe) {
        simEvents.emit('observe', { id, ...event.observe });
      }
    },
  });

  await bus.resolve({ load: manifestPath });

  // Startup parameters for scenarios that need runtime config (e.g. blockade intensity).
  if (Object.keys(init).length) {
    await bus.resolve({ init });
  }

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
