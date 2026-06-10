// World Events — data viewing scenario.
//
// Loads the geo-intelligence ingestion agents. No simulation logic —
// agents register, install their services, and answer *_query events
// from the connected client. Ticks are slow (one per 5 minutes) so
// agents can check their SWR refresh TTLs without wasting resources.
//
// The page starts this sim on load and subscribes to it; all queries
// from that session are routed to this bus.

export const gdelt = {
  inherits: '@orbital/agents/ingestion/gdelt.js',
};

export const ucdp = {
  inherits: '@orbital/agents/ingestion/ucdp.js',
};

export const acled = {
  inherits: '@orbital/agents/ingestion/acled.js',
};

export const cities = {
  inherits: '@orbital/agents/ingestion/cities.js',
};

export const naturalEarth = {
  inherits: '@orbital/agents/ingestion/natural-earth.js',
};

export const fsi = {
  inherits: '@orbital/agents/ingestion/fsi.js',
};
