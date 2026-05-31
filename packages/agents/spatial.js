// spatial — geographic indexing service.
//
// Installs bus.spatial on { registered: true }.
// Indexes entities that carry a spatial component: { id, spatial: { ll | llextent } }
// ll: [lon, lat, elev]  llextent: [[lon,lat,elev],[lon,lat,elev]]
//
// Query via bus:    await bus.resolve({ spatial_query: { near: [lon,lat], radius: 5000 } })
// Query directly:   bus.spatial.query({ near: [lon,lat], radius: 5000 })

import logger from '@orbital/utils';

const DEG_PER_CELL = 1;
const METERS_PER_DEG = 111_000;

function cellKey(lon, lat, deg) { return `${Math.floor(lon / deg)}:${Math.floor(lat / deg)}`; }

function center(spatial) {
  if (spatial.ll) return spatial.ll;
  if (spatial.llextent) {
    const [a, b] = spatial.llextent;
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ((a[2] ?? 0) + (b[2] ?? 0)) / 2];
  }
  return null;
}

function distMeters(a, b) {
  const R = 6_371_000;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLon = (b[0] - a[0]) * Math.PI / 180;
  const cosLat = Math.cos((a[1] + b[1]) / 2 * Math.PI / 180);
  return R * Math.sqrt(dLat * dLat + (dLon * cosLat) * (dLon * cosLat));
}

function cellsFor(spatial, deg) {
  if (spatial.ll) return [cellKey(spatial.ll[0], spatial.ll[1], deg)];
  if (spatial.llextent) {
    const [a, b] = spatial.llextent;
    const x0 = Math.floor(Math.min(a[0], b[0]) / deg);
    const x1 = Math.floor(Math.max(a[0], b[0]) / deg);
    const y0 = Math.floor(Math.min(a[1], b[1]) / deg);
    const y1 = Math.floor(Math.max(a[1], b[1]) / deg);
    const keys = [];
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        keys.push(`${x}:${y}`);
    return keys;
  }
  return [];
}

function createSpatialService(deg = DEG_PER_CELL) {
  const grid = new Map();
  const entities = new Map();

  function upsert(id, spatial) {
    if (entities.has(id))
      for (const k of cellsFor(entities.get(id).spatial, deg)) grid.get(k)?.delete(id);
    entities.set(id, { id, spatial });
    for (const k of cellsFor(spatial, deg)) {
      if (!grid.has(k)) grid.set(k, new Set());
      grid.get(k).add(id);
    }
  }

  function remove(id) {
    const e = entities.get(id);
    if (!e) return;
    for (const k of cellsFor(e.spatial, deg)) grid.get(k)?.delete(id);
    entities.delete(id);
  }

  function query({ near, radius, filter } = {}) {
    if (near && radius != null) {
      const radiusDeg = radius / METERS_PER_DEG;
      const cr = Math.ceil(radiusDeg / deg);
      const cx = Math.floor(near[0] / deg);
      const cy = Math.floor(near[1] / deg);
      const seen = new Set();
      const results = [];
      for (let dx = -cr; dx <= cr; dx++) {
        for (let dy = -cr; dy <= cr; dy++) {
          const bucket = grid.get(`${cx + dx}:${cy + dy}`);
          if (!bucket) continue;
          for (const id of bucket) {
            if (seen.has(id)) continue;
            seen.add(id);
            const e = entities.get(id);
            if (!e) continue;
            const c = center(e.spatial);
            if (c && distMeters(near, c) <= radius) results.push(e);
          }
        }
      }
      return results;
    }
    if (filter) return [...entities.values()].filter(e =>
      typeof filter === 'function' ? filter(e) : Object.keys(filter).every(k => e[k] === filter[k]));
    return [...entities.values()];
  }

  return { upsert, remove, query, get size() { return entities.size; } };
}

const spatialAgent = {
  id: 'bus.spatial',
  resolve(event, bus) {
    if (event.registered) {
      bus.install('spatial', createSpatialService());
      bus.resolve({ schema: { spatial: true, spatial_query: true } });
      return;
    }
    if (event.spatial_query) return bus.spatial.query(event.spatial_query);
    if (event.id && event.spatial && (event.spatial.ll || event.spatial.llextent))
      bus.spatial.upsert(event.id, event.spatial);
  },
};

export { spatialAgent as spatialHandler };  // back-compat named export
export default spatialAgent;
