// IPCC AR6 climate scenario — global temperature change 2024–2100.
//
// Energy balance model (EBM) driven by AR6 SSP CO₂ trajectories.
// Produces a PNG heatmap of local temperature anomaly at decade intervals.
//
// Run (SSP2-4.5, 2024–2100, one tick per year):
//   node packages/bus/run.js public/orbital/ipcc/manifest.js \
//     --ticks 76 --dt 31536000 --t0 2024-01-01T00:00:00Z
//
// Change scenario via env var:
//   SCENARIO=SSP5-8.5 node packages/bus/run.js ...  (options: SSP1-2.6 SSP2-4.5 SSP3-7.0 SSP5-8.5)
//
// Output PNGs land in: public/orbital/ipcc/output/

const scenario = process.env.SCENARIO ?? 'SSP2-4.5';

// Elevation data — used for land/sea distinction in pattern scaling and PNG rendering.
// Uses the 5 arc-minute downsampled GEBCO raster (18 MB, fast).
export const gebco = {
  elevation: {
    path:   'public/.data/elevation/global_5arcmin.i16',
    width:  4320,
    height: 2160,
  },
};

export const elevation = {
  inherits: '@orbital/agents/elevation.js',
};

export const atmosphere = {
  inherits:  '@orbital/agents/atmosphere.js',
  scenario,
  t0: 2024,
};

export const snapshot = {
  inherits:  '@orbital/agents/snapshot.js',
  outputDir: 'public/orbital/ipcc/output',
  prefix:    `temperature_${scenario}`,
  interval:  10,  // PNG every decade plus final frame
};
