// Example planetary baseline scenario.
//
// Run with:
//   node packages/bus/run.js public/orbital/planetary/manifest.js --ticks 4 --dt 21600
//
// (21600 s = 6 h, so 4 ticks walks a full day around the planet.)

// GEBCO 2024 global elevation+bathymetry.
// Dispatched into the bus so an elevation handler can register it when one exists.
// Run scripts/fetch-data.mjs to download the file into .data/.
export const gebco = {
  elevation: {
    target: 'public/.data/elevation/gebco-2024.u16',
    url: null,
    sha256: null,
    bytes: null,
    status: 'placeholder',
    license: 'GEBCO Compilation Group (2024) — see https://www.gebco.net/',
  },
};

export const world = {
  inherits: '@orbital/world',
  lats: [-60, -30, 0, 30, 60],
  lons: [-120, 0, 120],
  t0: '2026-06-21T12:00:00Z',
};

export const elevation = {
  inherits: './agents/elevation.js',
};

export const insolation = {
  inherits: './agents/insolation.js',
};

export const report = {
  inherits: './agents/report.js',
  fields: ['elevation_m', 'tsi_w_m2'],
};
