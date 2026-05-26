// Planetary baseline scenario.
//
// Run with:
//   node sim-core/bin/run.js public/anselm/planetary/manifest.js --ticks 4 --dt 21600
//
// (21600 s = 6 h, so 4 ticks walks a full day around the planet.)

export const meta = {
  name: 'planetary baseline',
  description: 'Synthetic 5x3 grid with elevation + top-of-atmosphere insolation.',
};

// External datasets the scenario wants on disk. Run:
//   node scripts/fetch-data.mjs public/anselm/planetary
// to materialise them under public/anselm/planetary/.data/
export const gebco = {
  kind: 'asset',
  name: 'gebco-2024',
  target: 'elevation/gebco-2024.u16',
  url: null,                  // fill in real URL after first manual download
  sha256: null,
  bytes: null,
  status: 'placeholder',
  license: 'GEBCO Compilation Group (2024) — see https://www.gebco.net/',
  notes: '86400x43200 global elevation+bathymetry. Not yet consumed; elevation agent still uses synthetic sample().',
};

export const world = {
  ref: './agents/world.js',
  lats: [-60, -30, 0, 30, 60],
  lons: [-120, 0, 120],
  t0: '2026-06-21T12:00:00Z',
};

export const elevation = {
  ref: './agents/elevation.js',
  // override sample(cell) here with a real heightfield lookup when available
};

export const insolation = {
  ref: './agents/insolation.js',
};

export const report = {
  ref: './agents/report.js',
  fields: ['elevation_m', 'tsi_w_m2'],
};
