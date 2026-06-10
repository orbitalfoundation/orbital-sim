// Strait of Hormuz — commodity flow and cascade simulation.
//
// Run (baseline — no closure):
//   node packages/bus/run.js public/orbital/hormuz/manifest.js \
//     --ticks 52 --dt 604800
//
// Run (80% closure):
//   BLOCKADE=0.8 node packages/bus/run.js public/orbital/hormuz/manifest.js \
//     --ticks 52 --dt 604800
//
// From the web: blockade is passed via the POST /api/sim body as init.blockade.
// The flows agent reads from { init: { blockade } } bus event.

// CLI: read blockade from env var; web: read from { init } event (see flows.js)
const blockade = parseFloat(process.env.BLOCKADE ?? '0');

// Geographic reference agents — needed by the web page for country centroids
// and FSI fragility scores (tipping point model).
export const naturalEarth = {
  inherits: '@orbital/agents/ingestion/natural-earth.js',
};

export const fsi = {
  inherits: '@orbital/agents/ingestion/fsi.js',
};

export const flows = {
  inherits: '@orbital/agents/hormuz/flows.js',
  blockade,
};

export const energy = {
  inherits: '@orbital/agents/hormuz/energy.js',
};

export const fertilizer = {
  inherits: '@orbital/agents/hormuz/fertilizer.js',
};

export const agriculture = {
  inherits: '@orbital/agents/hormuz/agriculture.js',
};

export const helium = {
  inherits: '@orbital/agents/hormuz/helium.js',
};

export const foodSecurity = {
  inherits: '@orbital/agents/hormuz/food-security.js',
};

export const observe = {
  inherits: '@orbital/agents/hormuz/observe.js',
};
