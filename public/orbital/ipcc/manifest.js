// IPCC AR6 climate scenario — global temperature change 2024–2100.
//
// Energy balance model (EBM) driven by AR6 SSP CO₂ trajectories.
// Frames are emitted via the bus and streamed to the web client over socket.io.
//
// CLI run (SSP2-4.5, 2024–2100):
//   node packages/bus/run.js public/orbital/ipcc/manifest.js \
//     --ticks 76 --dt 31536000
//
// CLI with different scenario or PNG output to disk:
//   SCENARIO=SSP5-8.5 OUTPUT_DIR=public/orbital/ipcc/output \
//   node packages/bus/run.js public/orbital/ipcc/manifest.js --ticks 76 --dt 31536000

const scenario = process.env.SCENARIO ?? 'SSP2-4.5';

// Elevation data — used for land/sea distinction in pattern scaling and PNG rendering.
// Uses the 5 arc-minute downsampled GEBCO raster (18 MB, fast).
export const gebco = {
  elevation: {
    path:   'public/.data/elevation/global_5arcmin.i16',
    url:    'https://raw.githubusercontent.com/anselm/orbital-data/main/elevation/global_5arcmin.i16',
    sha256: 'f94162f550d2292313209e68202d963f7a320878d2f87852c6adb15a90720794',
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
  outputDir: process.env.OUTPUT_DIR ?? null,  // null = stream only; set for CLI disk output
  prefix:    `temperature_${scenario}`,
  interval:  5,   // frame every 5 years (~5 per decade, smooth enough to watch)
};
