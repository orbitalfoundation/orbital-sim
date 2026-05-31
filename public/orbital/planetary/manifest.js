// Insolation baseline — top-of-atmosphere solar forcing over a coarse grid.
// No external data required; runs immediately.
//
// Run:
//   node packages/bus/run.js public/orbital/planetary/manifest.js --ticks 4 --dt 21600
//
// (4 ticks × 6 h = one full day; watch tsi_w_m2 rotate with the sun.)

export const world = {
  inherits: '@orbital/world',
  lats: [-60, -30, 0, 30, 60],
  lons: [-120, 0, 120],
  t0: '2026-06-21T12:00:00Z',
};

export const insolation = {
  inherits: './agents/insolation.js',
};

export const report = {
  inherits: './agents/report.js',
  fields: ['tsi_w_m2'],
};
