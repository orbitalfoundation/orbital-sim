// elevation — raster elevation service.
//
// Installs bus.elevation on { registered: true }.
// Handles { elevation: { target, url, sha256, width?, height? } } events to load data.
//
// bus.elevation.sample(lon, lat) — returns elevation in metres (null if no raster loaded).
// { elevation_query: { lon, lat } } — query interface.
//
// Raster format: raw little-endian Int16, row-major, north-up equirectangular.
// Width and height may be supplied in the component; otherwise inferred from file size
// assuming a 2:1 (lon:lat) aspect ratio.

import { readFile } from 'node:fs/promises';
import { resolve as resolvePath, isAbsolute } from 'node:path';
import logger from '@orbital/utils';

function createElevationService() {
  let raster = null; // { data: Int16Array, width, height }

  function sample(lon, lat) {
    if (!raster) return null;
    const { data, width, height } = raster;
    const x = ((lon + 180) / 360) * (width - 1);
    const y = ((90 - lat) / 180) * (height - 1);
    const xi = Math.max(0, Math.min(width - 1, Math.round(x)));
    const yi = Math.max(0, Math.min(height - 1, Math.round(y)));
    return data[yi * width + xi];
  }

  async function load({ target, url, width, height }) {
    const src = target || url;
    if (!src) return;
    const abs = isAbsolute(src) ? src : resolvePath(process.cwd(), src);
    try {
      const buf = await readFile(abs);
      const pixels = buf.length / 2;
      // default: 2:1 lon:lat aspect (standard global equirectangular)
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

export const elevationHandler = {
  id: 'bus.elevation',
  resolve(event, bus) {
    if (event.registered) {
      bus.install('elevation', createElevationService());
      bus.resolve({ schema: { elevation: true, elevation_query: true } });
      return;
    }
    if (event.elevation_query) {
      const { lon, lat } = event.elevation_query;
      return bus.elevation?.sample(lon, lat) ?? null;
    }
    if (event.elevation && typeof event.elevation === 'object') {
      if (event.elevation.status === 'placeholder') return;
      if (!event.elevation.target && !event.elevation.url) return;
      return bus.elevation?.load(event.elevation); // returns Promise; bus awaits it
    }
  },
};
