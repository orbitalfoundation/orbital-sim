// snapshot — renders the temperature anomaly field to a PNG on each interval tick.
//
// Produces an equirectangular (plate carrée) world map at 1440×720 (0.25°/pixel).
// Color scale: ivory (0°C) → yellow → orange → deep red (6°C+).
// Ocean pixels are darkened and blue-shifted relative to land so continents are
// immediately legible without a separate coastline dataset.
//
// After rendering, emits { frame: { year, tick, buf } } into the bus so the
// server tap can stream the PNG buffer to connected clients via socket.
//
// Configuration (override in manifest):
//   outputDir  — if set, also writes PNG files to this directory (useful for CLI)
//   prefix     — filename prefix when writing to disk (default 'temperature')
//   width      — output width in pixels (default 1440)
//   height     — output height in pixels (default 720)
//   interval   — emit a frame every N ticks as well as at done (0 = final only)

import { writeFile, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

// ---------- colour scale ----------
const STOPS = [
  [0,   [255, 252, 220]],  // ivory
  [0.5, [255, 235, 150]],  // pale yellow
  [1.5, [255, 200,  60]],  // yellow-amber
  [2.5, [240, 130,  20]],  // orange
  [3.5, [210,  60,  15]],  // red-orange
  [4.5, [170,  20,  10]],  // red
  [6.0, [ 80,   0,  20]],  // deep maroon
];

function anomalyRGB(dT) {
  const t = Math.max(0, Math.min(6, dT));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [t0, c0] = STOPS[i];
    const [t1, c1] = STOPS[i + 1];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return c0.map((v, j) => Math.round(v + f * (c1[j] - v)));
    }
  }
  return STOPS[STOPS.length - 1][1];
}

const OCEAN_BLEND = 0.55;
const OCEAN_TINT  = [10, 35, 80];

function pixelRGB(dT, isLand) {
  const [r, g, b] = anomalyRGB(dT);
  if (isLand) return [r, g, b];
  return [
    Math.round(r * OCEAN_BLEND + OCEAN_TINT[0] * (1 - OCEAN_BLEND)),
    Math.round(g * OCEAN_BLEND + OCEAN_TINT[1] * (1 - OCEAN_BLEND)),
    Math.round(b * OCEAN_BLEND + OCEAN_TINT[2] * (1 - OCEAN_BLEND)),
  ];
}

// ---------- render ----------
function renderToBuffer(bus, W, H) {
  const png = new PNG({ width: W, height: H });
  for (let yi = 0; yi < H; yi++) {
    const lat = 90 - (yi + 0.5) * (180 / H);
    for (let xi = 0; xi < W; xi++) {
      const lon    = (xi + 0.5) * (360 / W) - 180;
      const dT     = bus.atmosphere?.temperature_anomaly(lon, lat) ?? 0;
      const elev   = bus.elevation?.sample(lon, lat) ?? -1;
      const [r, g, b] = pixelRGB(dT, elev >= 0);
      const idx = (yi * W + xi) * 4;
      png.data[idx]     = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    png.pack()
      .on('data', d => chunks.push(d))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
}

// ---------- agent ----------
const snapshotAgent = {
  id: 'snapshot',
  outputDir: null,   // null = stream only; set to a path to also write files (CLI)
  prefix:    'temperature',
  width:     1440,
  height:    720,
  interval:  0,      // 0 = final frame only

  async resolve(event, bus) {
    if (event.frame) return;  // don't react to our own emitted frames
    if (!event.tick && !event.done) return;

    const shouldEmit =
      event.done ||
      (this.interval > 0 && event.tick % this.interval === 0);
    if (!shouldEmit) return;

    const year = bus.atmosphere?.year() ?? null;
    const buf  = await renderToBuffer(bus, this.width, this.height);

    // Emit frame into the bus — server tap picks this up and streams to socket.
    bus.resolve({ frame: { year, tick: event.tick ?? null, buf } })
      .catch(e => console.error('[snapshot] frame emit error:', e));

    // If outputDir is set (e.g. CLI mode), also write to disk.
    if (this.outputDir) {
      mkdirSync(this.outputDir, { recursive: true });
      const label = event.done && !event.tick ? `${year}_final` : String(year);
      const file  = join(this.outputDir, `${this.prefix}_${label}.png`);
      writeFile(file, buf, err => {
        if (err) console.error('[snapshot] write error:', err.message);
        else console.log(`[snapshot] wrote ${file}  (${this.width}×${this.height})`);
      });
    } else {
      console.log(`[snapshot] frame year=${year} tick=${event.tick ?? 'done'}  (${this.width}×${this.height})`);
    }
  },
};

snapshotAgent.resolve.after = 'atmosphere';

export default snapshotAgent;
