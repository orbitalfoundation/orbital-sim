#!/usr/bin/env node
// Downsample GEBCO 2026 tiles (15 arc-second, 21600×21600 per 90° tile)
// to a single global raster at 5 arc-minute resolution.
//
// Output: public/.data/elevation/global_5arcmin.i16
//   Format: raw Int16, little-endian, north-up equirectangular
//   Size:   4320 cols × 2160 rows = 9,331,200 cells × 2 bytes ≈ 18 MB
//   Extent: lon [-180, 180), lat [90, -90) top-to-bottom
//   Missing tiles: filled with 0
//
// Usage:
//   node scripts/gebco-downsample.mjs [tile-dir] [output-path]
//
// Defaults:
//   tile-dir:    public/.data/elevation/global_15arcsec.i16/
//   output-path: public/.data/elevation/global_5arcmin.i16

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const tileDir  = resolve(root, process.argv[2] ?? 'public/.data/elevation/global_15arcsec.i16/');
const outPath  = resolve(root, process.argv[3] ?? 'public/.data/elevation/global_5arcmin.i16');

// Source: 15 arc-second tiles, 21600×21600 per 90° quadrant
const SRC_PX_PER_DEG = 240;   // 3600 / 15 = 240 pixels per degree

// Target: 5 arc-minute global grid
const DST_PX_PER_DEG = 12;    // 60 / 5 = 12 pixels per degree
const DST_COLS       = 4320;  // 360 * 12
const DST_ROWS       = 2160;  // 180 * 12
const FACTOR         = SRC_PX_PER_DEG / DST_PX_PER_DEG; // = 20 — average 20×20 blocks

// ---- TIFF parsing (same logic as elevation.js) ----

function parseTiff(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const le = dv.getUint16(0, true) === 0x4949;
  const ifdOffset = dv.getUint32(4, le);
  const nEntries  = dv.getUint16(ifdOffset, le);
  let width = 0, height = 0, pixelOffset = 0;
  for (let i = 0; i < nEntries; i++) {
    const off   = ifdOffset + 2 + i * 12;
    const tag   = dv.getUint16(off, le);
    const count = dv.getUint32(off + 4, le);
    const val   = dv.getUint32(off + 8, le);
    if (tag === 256) width        = val;
    if (tag === 257) height       = val;
    if (tag === 273) pixelOffset  = count === 1 ? val : dv.getUint32(val, le);
  }
  if (!width || !height || !pixelOffset) throw new Error('required TIFF tags missing');
  return { width, height, pixelOffset };
}

function parseTileExtent(filename) {
  const m = filename.match(/n([-\d.]+)_s([-\d.]+)_w([-\d.]+)_e([-\d.]+)/);
  if (!m) return null;
  return { north: +m[1], south: +m[2], west: +m[3], east: +m[4] };
}

// ---- main ----

const out = new Int16Array(DST_COLS * DST_ROWS); // initialised to 0

const entries = await readdir(tileDir);
const tifFiles = entries.filter(n => n.endsWith('.tif') || n.endsWith('.tiff'));

console.log(`Found ${tifFiles.length} tile(s) in ${tileDir}`);
console.log(`Output: ${DST_COLS}×${DST_ROWS} at 5 arc-min → ${outPath}`);
console.log(`Block size: ${FACTOR}×${FACTOR} source pixels per output cell\n`);

for (const name of tifFiles) {
  const extent = parseTileExtent(name);
  if (!extent) { console.log(`  skip  ${name} (no extent in filename)`); continue; }

  const path = join(tileDir, name);
  process.stdout.write(`  loading ${name} ... `);
  const buf = await readFile(path);
  const { width, height, pixelOffset } = parseTiff(buf);

  const pixels = width * height;
  if (buf.byteOffset + pixelOffset + pixels * 2 > buf.buffer.byteLength) {
    console.log(`INCOMPLETE (${buf.length} bytes), skipping`);
    continue;
  }
  const src = new Int16Array(buf.buffer, buf.byteOffset + pixelOffset, pixels);
  console.log(`ok (${width}×${height})`);

  const { north, south, west, east } = extent;

  // For each destination cell whose centre falls within this tile, average
  // the corresponding FACTOR×FACTOR block of source pixels.
  //
  // Destination row 0 = lat 90 - (0.5/DST_PX_PER_DEG)  (cell centres)
  // Destination col 0 = lon -180 + (0.5/DST_PX_PER_DEG)

  // Destination row range covered by this tile
  const dstRowMin = Math.max(0,         Math.ceil( (90 - north) * DST_PX_PER_DEG ));
  const dstRowMax = Math.min(DST_ROWS,  Math.floor( (90 - south) * DST_PX_PER_DEG ));
  const dstColMin = Math.max(0,         Math.ceil( (west + 180) * DST_PX_PER_DEG ));
  const dstColMax = Math.min(DST_COLS,  Math.floor( (east + 180) * DST_PX_PER_DEG ));

  let cells = 0;
  for (let dr = dstRowMin; dr < dstRowMax; dr++) {
    // Centre latitude of this destination row
    const lat = 90 - (dr + 0.5) / DST_PX_PER_DEG;
    // Corresponding source row range in this tile
    const srTop    = Math.round((north - lat - 0.5 / DST_PX_PER_DEG) * SRC_PX_PER_DEG);
    const srBottom = Math.min(height, srTop + FACTOR);
    const sr0 = Math.max(0, srTop);

    for (let dc = dstColMin; dc < dstColMax; dc++) {
      const lon = -180 + (dc + 0.5) / DST_PX_PER_DEG;
      const scLeft  = Math.round((lon - west - 0.5 / DST_PX_PER_DEG) * SRC_PX_PER_DEG);
      const scRight = Math.min(width, scLeft + FACTOR);
      const sc0 = Math.max(0, scLeft);

      let sum = 0, count = 0;
      for (let sr = sr0; sr < srBottom; sr++) {
        for (let sc = sc0; sc < scRight; sc++) {
          sum += src[sr * width + sc];
          count++;
        }
      }
      if (count > 0) {
        out[dr * DST_COLS + dc] = Math.round(sum / count);
        cells++;
      }
    }
  }
  process.stdout.write(`    wrote ${cells.toLocaleString()} output cells\n`);
}

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, Buffer.from(out.buffer));
const mb = (out.buffer.byteLength / 1024 / 1024).toFixed(1);
console.log(`\nDone. Wrote ${mb} MB to ${outPath}`);
