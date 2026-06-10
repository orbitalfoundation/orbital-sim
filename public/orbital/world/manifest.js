// Reference manifest — all geo-intelligence ingestion agents.
//
// This is NOT loaded automatically by the server. It exists as a convenience
// template: copy agent declarations from here into scenario manifests that
// need them. Each scenario declares the agents it requires in its own manifest.
//
// Example: a scenario that needs cities and conflict events would add:
//   export const cities = { inherits: '@orbital/agents/ingestion/cities.js' };
//   export const gdelt  = { inherits: '@orbital/agents/ingestion/gdelt.js'  };

export const cities = {
  inherits: '@orbital/agents/ingestion/cities.js',
};

export const naturalEarth = {
  inherits: '@orbital/agents/ingestion/natural-earth.js',
};

export const fsi = {
  inherits: '@orbital/agents/ingestion/fsi.js',
};

export const gdelt = {
  inherits: '@orbital/agents/ingestion/gdelt.js',
};

export const ucdp = {
  inherits: '@orbital/agents/ingestion/ucdp.js',
};

export const acled = {
  inherits: '@orbital/agents/ingestion/acled.js',
};
