// elevation — raster or procedural elevation service.
//
// Installs bus.elevation on { registered: true }.
// Handles { elevation: { target|tiles, url, ... } } ECS component to load data.
//
// Sources (set via this.source or via { elevation: {...} } manifest component):
//   { path }          — single raw Int16 raster (north-up equirectangular)
//   { tiles }         — directory of GEBCO-style GeoTIFF tiles (n{N}_s{S}_w{W}_e{E} filenames)
//   (none)            — cosine approximation: 1000 * cos(lat)
//
// bus.elevation.sample(lon, lat) — elevation in metres (sync; tiles load async in background)

import { readFile, readdir } from 'node:fs/promises';
import { resolve as resolvePath, isAbsolute, join } from 'node:path';
import logger from '@orbital/utils';

// Parse width, height, and pixel-data byte offset from an uncompressed stripped TIFF buffer.
// Handles tag 256 (ImageWidth), 257 (ImageLength), 273 (StripOffsets).
// GEBCO tiles are uncompressed Int16, RowsPerStrip=1, fully contiguous — no decompression needed.
function parseTiff(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const le = dv.getUint16(0, true) === 0x4949;
  const ifdOffset = dv.getUint32(4, le);
  const nEntries = dv.getUint16(ifdOffset, le);
  let width = 0, height = 0, pixelOffset = 0;
  for (let i = 0; i < nEntries; i++) {
    const off = ifdOffset + 2 + i * 12;
    const tag   = dv.getUint16(off, le);
    const count = dv.getUint32(off + 4, le);
    const valOff = dv.getUint32(off + 8, le);
    if (tag === 256) width  = valOff;  // ImageWidth (count=1, inline uint32)
    if (tag === 257) height = valOff;  // ImageLength
    if (tag === 273) {
      // StripOffsets: count==1 → inline value; count>1 → pointer to array
      pixelOffset = count === 1 ? valOff : dv.getUint32(valOff, le);
    }
  }
  if (!width || !height || !pixelOffset) throw new Error('required TIFF tags missing (256/257/273)');
  return { width, height, pixelOffset };
}

function cosine(lat) { return Math.max(0, 1000 * Math.cos(lat * Math.PI / 180)); }

// Parse tile extent from GEBCO filename: gebco_YYYY_n{N}_s{S}_w{W}_e{E}_geotiff.tif
function parseTileExtent(filename) {
  const m = filename.match(/n([-\d.]+)_s([-\d.]+)_w([-\d.]+)_e([-\d.]+)/);
  if (!m) return null;
  return { north: +m[1], south: +m[2], west: +m[3], east: +m[4] };
}

function createElevationService() {
  // Single flat raster (load by path/target)
  let raster = null;
  // Tile set loaded from a directory: array of { extent, data: Int16Array | null, loading: bool, path }
  let tiles = null;

  function sampleRaster(lon, lat) {
    const { data, width, height } = raster;
    const x = ((lon + 180) / 360) * (width - 1);
    const y = ((90 - lat) / 180) * (height - 1);
    const xi = Math.max(0, Math.min(width - 1, Math.round(x)));
    const yi = Math.max(0, Math.min(height - 1, Math.round(y)));
    return data[yi * width + xi];
  }

  function sampleTiles(lon, lat) {
    if (!tiles) return cosine(lat);
    for (const tile of tiles) {
      const { north, south, west, east } = tile.extent;
      if (lat < south || lat > north || lon < west || lon >= east) continue;
      if (!tile.data) {
        if (!tile.loading && !tile.unavailable) loadTile(tile);
        return cosine(lat);
      }
      // Map lon/lat to pixel within this tile
      const { width, height } = tile;
      const x = ((lon - west) / (east - west)) * (width - 1);
      const y = ((north - lat) / (north - south)) * (height - 1);
      const xi = Math.max(0, Math.min(width - 1, Math.round(x)));
      const yi = Math.max(0, Math.min(height - 1, Math.round(y)));
      return tile.data[yi * width + xi];
    }
    return cosine(lat);
  }

  function sample(lon, lat) {
    if (tiles) return sampleTiles(lon, lat);
    if (raster) return sampleRaster(lon, lat);
    return cosine(lat);
  }

  async function loadTile(tile) {
    tile.loading = true;
    try {
      const buf = await readFile(tile.path);
      const { width, height, pixelOffset } = parseTiff(buf);
      const pixels = width * height;
      if (buf.byteOffset + pixelOffset + pixels * 2 > buf.buffer.byteLength) {
        logger.warn(`elevation: tile ${tile.path.split('/').pop()} is incomplete (${buf.length} bytes), skipping`);
        tile.unavailable = true;
        tile.loading = false;
        return;
      }
      tile.width = width;
      tile.height = height;
      tile.data = new Int16Array(buf.buffer, buf.byteOffset + pixelOffset, pixels);
      logger.info(`elevation: loaded tile ${tile.path.split('/').pop()} (${width}×${height})`);
    } catch (err) {
      logger.warn(`elevation: cannot load tile ${tile.path.split('/').pop()}: ${err.message}`);
      tile.unavailable = true;
    }
    tile.loading = false;
  }

  async function loadTilesDir(dir) {
    const abs = isAbsolute(dir) ? dir : resolvePath(process.cwd(), dir);
    let entries;
    try {
      entries = await readdir(abs);
    } catch (err) {
      logger.warn(`elevation: cannot read tile dir ${abs}: ${err.message}`);
      return;
    }
    const found = [];
    for (const name of entries) {
      if (!name.endsWith('.tif') && !name.endsWith('.tiff')) continue;
      const extent = parseTileExtent(name);
      if (!extent) continue;
      found.push({ extent, path: join(abs, name), data: null, loading: false });
    }
    if (!found.length) { logger.warn(`elevation: no GeoTIFF tiles found in ${abs}`); return; }
    tiles = found;
    logger.info(`elevation: registered ${tiles.length} tile(s) from ${abs}`);
    // Eagerly load all available tiles (each ~930 MB — RAM must allow)
    await Promise.all(tiles.map(loadTile));
  }

  async function load({ target, path: p, url, tiles: tilesDir, width, height }) {
    if (tilesDir) return loadTilesDir(tilesDir);
    const src = p || target || url;
    if (!src) return;
    const abs = isAbsolute(src) ? src : resolvePath(process.cwd(), src);
    try {
      const buf = await readFile(abs);
      const pixels = buf.length / 2;
      const w = width  || Math.round(Math.sqrt(pixels * 2));
      const h = height || Math.round(pixels / w);
      raster = { data: new Int16Array(buf.buffer, buf.byteOffset, pixels), width: w, height: h };
      logger.info(`elevation: loaded ${w}×${h} raster from ${abs}`);
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
    // ECS component: { elevation: { target|path|tiles, url, status, ... } }
    if (event.elevation && typeof event.elevation === 'object') {
      if (event.elevation.status === 'placeholder') return;
      if (!event.elevation.target && !event.elevation.path && !event.elevation.url && !event.elevation.tiles) return;
      return bus.elevation?.load(event.elevation);
    }
  },
};

export { elevationAgent as elevationHandler };  // back-compat named export
export default elevationAgent;
