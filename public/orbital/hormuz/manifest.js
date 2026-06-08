// Strait of Hormuz — commodity flow and cascade simulation.
//
// Models the second-order economic impacts of a Hormuz closure:
//   Blockade → oil/LNG flow reduction → energy price spike
//             → fertilizer plant shutdowns → urea/ammonia price spike
//             → reduced crop application → yield decline
//             → food price inflation → food insecurity (country-level)
//   Blockade → helium supply offline → boiloff clock starts → semiconductor/MRI impact
//
// The cascade emerges from the agent structure — only the blockade parameter
// is set externally. All downstream effects fall out of the system dynamics.
//
// Run (baseline — no closure):
//   node packages/bus/run.js public/orbital/hormuz/manifest.js \
//     --ticks 52 --dt 604800
//
// Run (80% closure, 52 weekly ticks = 1 year):
//   BLOCKADE=0.8 node packages/bus/run.js public/orbital/hormuz/manifest.js \
//     --ticks 52 --dt 604800
//
// BLOCKADE: 0 = strait fully open (baseline), 1 = fully closed
// DT: 604800 = 1 week in seconds (recommended step for this model)

const blockade = parseFloat(process.env.BLOCKADE ?? '0');

// ACLED conflict events — provides bus.acled for querying incidents near Hormuz.
// Requires ACLED_KEY + ACLED_EMAIL in .env. Starts cleanly without credentials
// but serves an empty dataset. Register at https://acleddata.com/ (free, research).
export const acled = {
  inherits: '@orbital/agents/ingestion/acled.js',
  countries: [
    'Iran', 'Iraq', 'Saudi Arabia', 'Kuwait', 'Bahrain',
    'Qatar', 'United Arab Emirates', 'Oman', 'Yemen',
  ],
  sinceYears: 2,
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
