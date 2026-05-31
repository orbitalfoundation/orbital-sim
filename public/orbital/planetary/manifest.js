// Insolation baseline — no external data required.
//
// Run:
//   node packages/bus/run.js public/orbital/planetary/manifest.js --ticks 4 --dt 21600

export const insolation = {
  inherits: '@orbital/agents/insolation.js',
  lats: [-60, -30, 0, 30, 60],
  lons: [-120, 0, 120],
  t0: '2026-06-21T12:00:00Z',
};

export const report = {
  inherits: '@orbital/agents/report.js',
  fields: ['tsi_w_m2'],
};
