// sys — the pub/sub kernel.
//
// Lineage: descended from orbital-sys (github.com/orbitalfoundation/orbital-sys)
// with a few simplifications:
//   - state is *not* cloned; resolvers may mutate events in place
//   - resolvers are registered by publishing an object whose `resolve` is a function
//   - filters are shallow key-existence checks against the event
//   - ordering hints: resolve.before / resolve.after carry an id reference
//   - sim.resolve(event) walks the chain synchronously; resolvers may be async
//     but the kernel does not await them by default (avoid blocking the tick)
//
// Reserved keys on registered objects: id, ref, resolve, parent, children
// Reserved keys on events:             tick, t, dt, remove

let _seq = 0;
const _nextId = (hint) => `${hint || 'agent'}-${++_seq}`;

export function createSim({ tStart = 0 } = {}) {
  // resolvers in registration order; we re-sort on every register
  const resolvers = []; // { entity, fn, filter }
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
    if (!entity || typeof entity !== 'object') return entity;
    if (typeof entity.resolve !== 'function') return entity;
    if (!entity.id) entity.id = _nextId(entity.ref ? basename(entity.ref) : 'agent');
    if (byId.has(entity.id)) {
      // duplicate id — replace, don't double-register
      const i = resolvers.findIndex((r) => r.entity.id === entity.id);
      if (i >= 0) resolvers.splice(i, 1);
    }
    byId.set(entity.id, entity);
    resolvers.push({ entity, fn: entity.resolve, filter: entity.resolve.filter });
    reorder();
    return entity;
  }

  function resolve(event) {
    if (event == null) return event;
    if (Array.isArray(event)) {
      for (const e of event) resolve(e);
      return event;
    }
    // self-registering: if event itself carries resolve(), register it first
    if (typeof event.resolve === 'function') register(event);

    // handle removal
    if (event.remove && byId.has(event.remove)) {
      const id = event.remove;
      const i = resolvers.findIndex((r) => r.entity.id === id);
      if (i >= 0) resolvers.splice(i, 1);
      byId.delete(id);
    }

    // dispatch — call as method so `this` is the agent entity
    for (const r of resolvers) {
      if (!matches(r.filter, event)) continue;
      if (event.force_sys_abort) break;
      try {
        const out = r.entity.resolve(event, sim);
        if (out && out.force_sys_abort) event.force_sys_abort = true;
      } catch (err) {
        console.error(`[sim-core] resolver '${r.entity.id}' threw on event`, event, err);
      }
    }
    return event;
  }

  const sim = {
    get time() { return t; },
    set time(v) { t = v; },
    resolve,
    register,
    agents: byId,
    has(id) { return byId.has(id); },
    get(id) { return byId.get(id); },
    list() { return [...byId.values()]; },
  };

  return sim;
}

function basename(p) {
  const s = String(p).split(/[\\/]/).pop() || 'agent';
  return s.replace(/\.[^.]+$/, '');
}
