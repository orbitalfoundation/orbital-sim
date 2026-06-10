// Elevation + insolation with GEBCO 2026 bathymetry/topography.
//
// Two elevation sources are available — use whichever suits:
//   path:  18 MB flat raster at 5 arc-minute resolution (fast, low-memory)
//   tiles: 7 GB GeoTIFF tiles at 15 arc-second resolution (full detail)
//
// Run:
//   node packages/bus/run.js public/orbital/planetary/manifest-gebco.js --ticks 4 --dt 21600

// GEBCO 2026 — 5 arc-minute downsampled raster.
// Auto-downloaded from orbital-data GitHub repo by fetch-data.mjs if absent.
export const gebco = {
  elevation: {
    path:   'public/.data/elevation/global_5arcmin.i16',
    url:    'https://raw.githubusercontent.com/anselm/orbital-data/main/elevation/global_5arcmin.i16',
    sha256: 'f94162f550d2292313209e68202d963f7a320878d2f87852c6adb15a90720794',
    width:  4320,
    height: 2160,
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
