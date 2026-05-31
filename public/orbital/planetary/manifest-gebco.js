// Elevation + insolation with GEBCO 2026 bathymetry/topography.
//
// Before running, fetch the elevation raster:
//   node scripts/fetch-data.mjs public/orbital/planetary/manifest-gebco.js
// (fill in url + sha256 below first — see https://www.gebco.net/)
//
// Run:
//   node packages/bus/run.js public/orbital/planetary/manifest-gebco.js --ticks 4 --dt 21600
//
// elevation_m falls back to a cosine approximation until real data is loaded.

// GEBCO 2026 global elevation+bathymetry (15 arc-second, equirectangular, 8 tiles).
// Set url + sha256, then run scripts/fetch-data.mjs to download.
export const gebco = {
  elevation: {
    tiles: 'public/.data/elevation/gebco_tiles/',
    url: null,
    sha256: null,
    status: 'placeholder',
    license: 'GEBCO Compilation Group (2026) — see https://www.gebco.net/',
  },
};

export const elevation = {
  inherits: '@orbital/agents/elevation.js',
};

export const insolation = {
  inherits: '@orbital/agents/insolation.js',
  lats: [-60, -30, 0, 30, 60],
  lons: [-120, 0, 120],
  t0: '2026-06-21T12:00:00Z',
};

export const report = {
  inherits: '@orbital/agents/report.js',
  fields: ['tsi_w_m2', 'elevation_m'],
};
