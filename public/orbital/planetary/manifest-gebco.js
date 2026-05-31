// Elevation + insolation with GEBCO 2024 bathymetry/topography.
//
// Before running, fetch the elevation raster:
//   node scripts/fetch-data.mjs public/orbital/planetary/manifest-gebco.js
// (fill in url + sha256 below first — see GEBCO download portal)
//
// Run:
//   node packages/bus/run.js public/orbital/planetary/manifest-gebco.js --ticks 4 --dt 21600
//
// elevation_m falls back to a cosine approximation until real data is loaded.

// GEBCO 2024 global elevation+bathymetry (15 arc-second, equirectangular).
// Set url + sha256, then run scripts/fetch-data.mjs to download.
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
