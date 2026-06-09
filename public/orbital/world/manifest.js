// World bus — infrastructure agents that run for the lifetime of the server.
// These are data services, not simulations. They populate SQLite and respond
// to *_query events from any bus instance or from socket clients.
//
// Add agents here to make them universally available.
// Each agent installs its bus service on registration and handles its own
// background sync lifecycle (SWR pattern with per-agent TTL).

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
