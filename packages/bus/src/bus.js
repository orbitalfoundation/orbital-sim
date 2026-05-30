
import { randomUUID } from 'node:crypto';
import logger from '@orbital/utils';

import { manifestLoader } from './load.js';
import { schemaHandler } from './schema.js';
import { tickDriver } from './tick.js';

const isServer = typeof window === 'undefined';

function basename(p) {
  const s = String(p).split(/[\\/]/).pop() || 'agent';
  return s.replace(/\.[^.]+$/, '');
}

export function createBus({ tStart = 0, description = 'simulation bus' } = {}) {

  let time = tStart;
  let bus; // forward reference — inner functions close over this binding

  function matches(filter, event) {
    if (!filter) return true;
    for (const k of Object.keys(filter)) {
      if (!(k in event)) return false;
    }
    return true;
  }

  // topological sort honouring resolve.before / resolve.after — O(n²), fine for hundreds of agents
  function reorder() {
    const idx = new Map(bus.resolvers.map((r, i) => [r.entity.id, i]));
    let changed = true;
    let guard = 0;
    while (changed && guard++ < bus.resolvers.length * 4) {
      changed = false;
      for (let i = 0; i < bus.resolvers.length; i++) {
        const r = bus.resolvers[i];
        const before = r.fn.before;
        const after  = r.fn.after;
        if (before && idx.has(before)) {
          const j = idx.get(before);
          if (i > j) { bus.resolvers.splice(j, 0, bus.resolvers.splice(i, 1)[0]); changed = true; break; }
        }
        if (after && idx.has(after)) {
          const j = idx.get(after);
          if (i < j) { bus.resolvers.splice(j + 1, 0, bus.resolvers.splice(i, 1)[0]); changed = true; break; }
        }
      }
      if (changed) {
        idx.clear();
        bus.resolvers.forEach((r, i) => idx.set(r.entity.id, i));
      }
    }
  }

  function register(entity) {
    if (!entity || typeof entity !== 'object') return;
    if (typeof entity.resolve !== 'function') return;
    if (!entity.id) entity.id = `handler-${entity.inherits ? basename(entity.inherits) : bus._seq++}`;

    if (bus.resolvers.some(r => r.entity === entity)) {
      logger.warn(`bus: entity ${entity.id} already registered by ref`);
      return;
    }

    // duplicate id — replace the existing entry
    if (bus.agents.has(entity.id)) {
      const i = bus.resolvers.findIndex((r) => r.entity.id === entity.id);
      if (i >= 0) bus.resolvers.splice(i, 1);
    }

    bus.agents.set(entity.id, entity);
    bus.resolvers.push({ entity, fn: entity.resolve, filter: entity.resolve.filter });
    reorder();

    entity.resolve({ registered: true }, bus);
  }

  async function resolve(event) {

    if (Array.isArray(event)) {
      for (const e of event) await resolve(e);
      return;
    }

    if (event == null || event === 'undefined' || typeof event !== 'object') {
      logger.error(`bus: resolve invalid event`, event);
      return;
    }

    if (typeof event.resolve === 'function') {
      register(event);
      return;
    }

    // snapshot resolvers so mid-dispatch registrations don't affect this pass
    let result;
    const activeResolvers = bus.resolvers.slice();
    for (const r of activeResolvers) {
      if (!matches(r.filter, event)) continue;
      try {
        const out = await r.entity.resolve(event, bus);
        if (out !== undefined) { result = out; break; } // first-responder: non-undefined stops the chain
      } catch (err) {
        logger.error(`bus: resolve '${r.entity.id}' threw on`, event, err);
      }
    }

    // obliterate after full dispatch so the handler sees the event before removal
    if (event.obliterate === true && event.id) {
      const id = event.id;
      const i = bus.resolvers.findIndex(r => r.entity.id === id);
      if (i >= 0) bus.resolvers.splice(i, 1);
      bus.agents.delete(id);
    }

    return result;
  }

  bus = {
    _seq: 0,
    resolvers: [],
    agents: new Map(),
    uuid: randomUUID(),
    description,
    isServer,
    schemas: new Map(),
    get time() { return time; },
    set time(value) { time = value; },
    resolve,
    register,
    has(id) { return bus.agents.has(id); },
    get(id) { return bus.agents.get(id); },
    list() { return [...bus.agents.values()]; },
    install(name, service) {
      if (bus[name] !== undefined) {
        logger.warn(`bus: '${name}' already installed, ignoring`);
        return false;
      }
      bus[name] = service;
      return true;
    },
  };

  register(manifestLoader);
  register(schemaHandler);
  register(tickDriver);

  // seed reserved vocabulary so collision checks catch conflicts with core keys immediately
  const CORE_EVENT_KEYS = ['tick', 't', 'dt', 'load', 'obliterate', 'registered', 'done', 'force_sys_abort', 'run', 'schema'];
  const CORE_ENTITY_KEYS = ['id', 'inherits', 'resolve'];
  for (const key of [...CORE_EVENT_KEYS, ...CORE_ENTITY_KEYS]) {
    bus.schemas.set(key, { _claimant: 'bus.core' });
  }

  return bus;
}
