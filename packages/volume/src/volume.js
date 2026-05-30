// volume — spatial indexing service for the orbital bus.
//
// ll: [lon, lat, elevation]  — GeoJSON / cartesian order (x, y, z); elevation in metres
// llextent: [[lon,lat,elev],[lon,lat,elev]]  — SW corner, NE corner
//
// Dynamic entities (no resolve fn) are indexed automatically when they pass through the bus.
// Resolver-based agents that have a spatial presence should dispatch their own volume on load:
//   bus.resolve({ id: this.id, volume: this.volume })
//
// Query via bus:   const hits = await bus.resolve({ volume_query: { near: [lon,lat], radius: 5000 } })
// Query directly:  bus.volume.query({ near: [lon,lat], radius: 5000 })

import logger from '@orbital/utils';

const DEG_PER_CELL = 1;          // ~111 km per cell; configurable at createVolumeService()
const METERS_PER_DEG = 111_000;  // equirectangular approximation

function cellKey(lon, lat, cellDeg) {
  return `${Math.floor(lon / cellDeg)}:${Math.floor(lat / cellDeg)}`;
}

function center(vol) {
  if (vol.ll) return vol.ll;
  if (vol.llextent) {
    const [a, b] = vol.llextent;
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ((a[2] ?? 0) + (b[2] ?? 0)) / 2];
  }
  return null;
}

// equirectangular distance in metres — good enough for radii under ~500 km
function distMeters(a, b) {
  const R = 6_371_000;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLon = (b[0] - a[0]) * Math.PI / 180;
  const cosLat = Math.cos((a[1] + b[1]) / 2 * Math.PI / 180);
  return R * Math.sqrt(dLat * dLat + (dLon * cosLat) * (dLon * cosLat));
}

function cellsFor(vol, cellDeg) {
  if (vol.ll) {
    return [cellKey(vol.ll[0], vol.ll[1], cellDeg)];
  }
  if (vol.llextent) {
    const [a, b] = vol.llextent;
    const x0 = Math.floor(Math.min(a[0], b[0]) / cellDeg);
    const x1 = Math.floor(Math.max(a[0], b[0]) / cellDeg);
    const y0 = Math.floor(Math.min(a[1], b[1]) / cellDeg);
    const y1 = Math.floor(Math.max(a[1], b[1]) / cellDeg);
    const keys = [];
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        keys.push(`${x}:${y}`);
    return keys;
  }
  return [];
}

function createVolumeService(cellDeg = DEG_PER_CELL) {
  const grid = new Map();     // cellKey → Set<id>
  const entities = new Map(); // id → { id, volume }

  function upsert(id, vol) {
    // remove stale index entries for this id
    if (entities.has(id)) {
      for (const k of cellsFor(entities.get(id).volume, cellDeg)) {
        grid.get(k)?.delete(id);
      }
    }
    entities.set(id, { id, volume: vol });
    for (const k of cellsFor(vol, cellDeg)) {
      if (!grid.has(k)) grid.set(k, new Set());
      grid.get(k).add(id);
    }
  }

  function remove(id) {
    const e = entities.get(id);
    if (!e) return;
    for (const k of cellsFor(e.volume, cellDeg)) grid.get(k)?.delete(id);
    entities.delete(id);
  }

  function query({ near, radius, filter } = {}) {
    // spatial: return entities within radius metres of near=[lon,lat]
    if (near && radius != null) {
      const radiusDeg = radius / METERS_PER_DEG;
      const cellRadius = Math.ceil(radiusDeg / cellDeg);
      const cx = Math.floor(near[0] / cellDeg);
      const cy = Math.floor(near[1] / cellDeg);
      const seen = new Set();
      const results = [];
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        for (let dy = -cellRadius; dy <= cellRadius; dy++) {
          const bucket = grid.get(`${cx + dx}:${cy + dy}`);
          if (!bucket) continue;
          for (const id of bucket) {
            if (seen.has(id)) continue;
            seen.add(id);
            const e = entities.get(id);
            if (!e) continue;
            const c = center(e.volume);
            if (c && distMeters(near, c) <= radius) results.push(e);
          }
        }
      }
      return results;
    }

    // predicate filter: return all entities passing filter(entity)
    if (filter) {
      return [...entities.values()].filter(e =>
        typeof filter === 'function' ? filter(e) : Object.keys(filter).every(k => e[k] === filter[k])
      );
    }

    return [...entities.values()];
  }

  return { upsert, remove, query, get size() { return entities.size; } };
}

export const volumeHandler = {
  id: 'bus.volume',

  resolve(event, bus) {
    // lazy-init per bus instance
    if (!bus.volume) {
      bus.volume = createVolumeService();
      // claim component and query namespaces
      bus.resolve({ id: 'bus.volume-schema', schema: { volume: true, volume_query: true } });
    }

    // query: first handler to answer stops the chain
    if (event.volume_query) {
      return bus.volume.query(event.volume_query);
    }

    // index any entity with spatial data
    if (event.id && event.volume && (event.volume.ll || event.volume.llextent)) {
      bus.volume.upsert(event.id, event.volume);
    }
  },
};
