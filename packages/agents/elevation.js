// elevation — raster or procedural elevation service.
//
// Installs bus.elevation on { registered: true }.
// Handles { elevation: { target|tiles, url, ... } } ECS component to load data.
//
// Sources (set via this.source or via { elevation: {...} } manifest component):
//   { path }          — single raw Int16 raster (north-up equirectangular)
//   { tiles }         — directory of GeoTIFF tiles (stub — implement when data arrives)
//   { type:'perlin' } — procedural noise (stub — falls back to cosine)
//   (none)            — cosine approximation: 1000 * cos(lat)
//
// bus.elevation.sample(lon, lat) — elevation in metres

import { readFile } from 'node:fs/promises';
import { resolve as resolvePath, isAbsolute } from 'node:path';
import logger from '@orbital/utils';

function cosine(lat) { return Math.max(0, 1000 * Math.cos(lat * Math.PI / 180)); }

function createElevationService() {
  let raster = null;

  function sample(lon, lat) {
    if (!raster) return cosine(lat);
    const { data, width, height } = raster;
    const x = ((lon + 180) / 360) * (width - 1);
    const y = ((90 - lat) / 180) * (height - 1);
    const xi = Math.max(0, Math.min(width - 1, Math.round(x)));
    const yi = Math.max(0, Math.min(height - 1, Math.round(y)));
    return data[yi * width + xi];
  }

  async function load({ target, path: p, url, width, height }) {
    const src = p || target || url;
    if (!src) return;
    const abs = isAbsolute(src) ? src : resolvePath(process.cwd(), src);
    try {
      const buf = await readFile(abs);
      const pixels = buf.length / 2;
      const w = width  || Math.round(Math.sqrt(pixels * 2));
      const h = height || Math.round(pixels / w);
      raster = { data: new Int16Array(buf.buffer, buf.byteOffset, pixels), width: w, height: h };
      logger.info(`elevation: loaded ${w}×${h} raster (${pixels} cells) from ${abs}`);
    } catch (err) {
      logger.warn(`elevation: cannot load ${src}: ${err.message}`);
    }
  }

  return { sample, load };
}

const elevationAgent = {
  id: 'bus.elevation',

  resolve(event, bus) {
    if (event.registered) {
      bus.install('elevation', createElevationService());
      bus.resolve({ schema: { elevation: true, elevation_query: true } });
      // load from this.source if provided directly on the agent entry
      if (this.source) bus.elevation.load(this.source);
      return;
    }
    if (event.elevation_query) {
      const { lon, lat } = event.elevation_query;
      return bus.elevation?.sample(lon, lat) ?? null;
    }
    // ECS component: { elevation: { target|path, url, status, ... } }
    if (event.elevation && typeof event.elevation === 'object') {
      if (event.elevation.status === 'placeholder') return;
      if (!event.elevation.target && !event.elevation.path && !event.elevation.url) return;
      return bus.elevation?.load(event.elevation);
    }
  },
};

export { elevationAgent as elevationHandler };  // back-compat named export
export default elevationAgent;
