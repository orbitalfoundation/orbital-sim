
import { randomUUID } from 'node:crypto';
import logger from '@orbital/utils';

// built in handlers

import { manifestLoader } from './load.js';
import { schemaHandler } from './schema.js';
import { tickDriver } from './tick.js'; // keep this last

const isServer = typeof window === 'undefined';

let _seq = 0;
const _nextId = (hint) => `handler-${hint || _seq++}`;

function basename(p) {
  const s = String(p).split(/[\\/]/).pop() || 'agent';
  return s.replace(/\.[^.]+$/, '');
}

export function createBus({ tStart = 0, description = 'simulation bus' } = {}) {

  const resolvers = [];
  const byId = new Map();
  let t = tStart;

  function matches(filter, event) {
    if (!filter) return true;
    for (const k of Object.keys(filter)) {
      if (!(k in event)) return false;
    }
    return true;
  }

  function reorder() {
    // simple topological pass honouring resolve.before / resolve.after (ids)
    // O(n^2) — fine for hundreds of agents, revisit if it bites
    const idx = new Map(resolvers.map((r, i) => [r.entity.id, i]));
    let changed = true;
    let guard = 0;
    while (changed && guard++ < resolvers.length * 4) {
      changed = false;
      for (let i = 0; i < resolvers.length; i++) {
        const r = resolvers[i];
        const before = r.fn.before;
        const after  = r.fn.after;
        if (before && idx.has(before)) {
          const j = idx.get(before);
          if (i > j) { resolvers.splice(j, 0, resolvers.splice(i, 1)[0]); changed = true; break; }
        }
        if (after && idx.has(after)) {
          const j = idx.get(after);
          if (i < j) { resolvers.splice(j + 1, 0, resolvers.splice(i, 1)[0]); changed = true; break; }
        }
      }
      if (changed) {
        idx.clear();
        resolvers.forEach((r, i) => idx.set(r.entity.id, i));
      }
    }
  }

  function register(entity) {
    if (!entity || typeof entity !== 'object') return;
    if (typeof entity.resolve !== 'function') return;
    if (!entity.id) entity.id = _nextId(entity.ref ? basename(entity.ref) : 'agent');
    
    // Detect duplicate object ref (same object already registered)
    if (resolvers.some(r => r.entity === entity)) {
      logger.warn(`bus: entity ${entity.id} already registered by ref`);
      return;
    }
    
    // Detect duplicate ID (another entity with same id — replace it)
    if (byId.has(entity.id)) {
      const i = resolvers.findIndex((r) => r.entity.id === entity.id);
      if (i >= 0) resolvers.splice(i, 1);
    }
    
    byId.set(entity.id, entity);
    resolvers.push({ entity, fn: entity.resolve, filter: entity.resolve.filter });
    reorder();
  }

  //
  // resolve is a public interface for both dispatching and registering
  //
  async function resolve(event) {

    // unroll arrays
    if (Array.isArray(event)) {
      for (const e of event) await resolve(e);
      return;
    }

    // sanity check; by this point all events should be objects
    if (event == null || event === 'undefined' || typeof event !== 'object') {
      logger.error(`bus: resolve invalid event`, event);
      return;
    }

    // remove a resolver? early exit if so
    if (event.resolve_remove && byId.has(event.resolve_remove)) {
      const id = event.resolve_remove;
      const i = resolvers.findIndex((r) => r.entity.id === id);
      if (i >= 0) resolvers.splice(i, 1);
      byId.delete(id);
      return;
    }

    // register any new resolvers; current policy is to early exit in this case
    if (typeof event.resolve === 'function') {
      register(event);
      return;
    }

    // dispatch to a stable snapshot of the resolvers list
    const activeResolvers = resolvers.slice();
    for (const r of activeResolvers) {
      if (!matches(r.filter, event)) continue;
      try {
        const out = await r.entity.resolve(event, bus);
        // special support to slightly abuse the pub/sub system to allow for sync query results
        if (out !== undefined) return out;
      } catch (err) {
        logger.error(`bus: resolve '${r.entity.id}' threw on`, event, err);
      }
    }
  }

  const bus = {
    uuid: randomUUID(),
    description,
    isServer,
    schemas: new Map(),
    get time() { return t; },
    set time(v) { t = v; },
    resolve,
    register,
    agents: byId,
    has(id) { return byId.has(id); },
    get(id) { return byId.get(id); },
    list() { return [...byId.values()]; },
  };

  register(manifestLoader);
  register(schemaHandler);
  register(tickDriver); // register this last

  // Seed reserved vocabulary so schema collision checks catch conflicts with core keys.
  // Event keys reserved by the bus and its built-in handlers:
  // @todo built in handlers could do this themselves
  const CORE_EVENT_KEYS = ['tick', 't', 'dt', 'load', 'resolve_remove', 'done', 'force_sys_abort', 'run', 'schema'];

  // Entity/registration keys reserved on all registered objects:
  const CORE_ENTITY_KEYS = ['id', 'ref', 'resolve'];
  for (const key of [...CORE_EVENT_KEYS, ...CORE_ENTITY_KEYS]) {
    bus.schemas.set(key, { _claimant: 'bus.core' });
  }

  return bus;
}
