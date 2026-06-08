// sims — bus instance lifecycle.
// Exports:
//   worldBus — persistent infrastructure bus (cities, events, geo data).
//              Starts at server init; agents self-initialise and sync in background.
//              Clients query it via socket: emit('query', { id, key, args })
//
//   startSim / stopSim / getSim / listSims — per-session simulation buses.

import { createBus } from '@orbital/bus';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath }          from 'node:url';
import { EventEmitter }           from 'node:events';

const _dir      = dirname(fileURLToPath(import.meta.url));
const repoRoot  = resolve(_dir, '../..');
const worldManifest = join(repoRoot, 'public/orbital/world/manifest.js');

// ---------- world bus (singleton, server lifetime) ----------

export const worldBus = createBus({ description: 'world bus — infrastructure agents' });
console.log('[worldBus] starting — loading', worldManifest);
await worldBus.resolve({ load: worldManifest });
console.log('[worldBus] ready —', worldBus.list().map(a => a.id).join(', '));

// ---------- per-session sim buses ----------

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
