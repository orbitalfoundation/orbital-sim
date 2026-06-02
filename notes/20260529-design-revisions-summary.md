# 2026-05-29 changes

## refactored packages/bus

Completed a mid-session refactor that a previous AI had started. The core change was replacing the `createSim()` factory pattern with `createBus()`, removing the `createSim` indirection entirely. The manifest loader and tick driver, which previously had to be passed in at startup, are now auto-registered inside `createBus()` — the bus bootstraps itself. This reduces the cognitive burden on users: you call `createBus()` and it works.

Three built-in handlers are wired at construction: `manifestLoader` (loads ESM manifest files, installs `bus.scenario`), `tickDriver` (responds to `{ run: true, ticks, dt }` for batch ticking or `{ run: 'realtime', hz, dt }` for interval-based), and `schemaHandler` (namespace reservation and collision detection via `bus.schemas`). Everything else is opt-in via `bus.register()`.

The bus now seeds reserved vocabulary into `bus.schemas` on startup so collisions against core keys (`tick`, `t`, `dt`, `load`, `resolve_remove`, etc.) are caught immediately.

The `bus.resolve()` first-responder pattern was made explicit: the resolver chain stops and returns as soon as any handler returns a non-undefined value. This makes the bus double as a query mechanism — handlers that answer a question stop the chain, handlers that don't return undefined pass through.

## added packages/utils improvements

Added `mulberry32` — a seeded deterministic PRNG — to `packages/utils`. Also migrated the utils test suite from whatever it was using to `node:test` (Node's built-in runner), consistent with the rest of the project.

## added packages/spatial

Created a new `packages/spatial` package for geographic indexing. Entities declare a `spatial` component with either `ll: [lon, lat, elev]` for a point or `llextent: [[lon,lat,elev],[lon,lat,elev]]` for a bounding box. The handler self-installs as `bus.spatial` on first use and claims its namespace via the schema handler.

Internally uses a degree-cell grid (1° ≈ 111 km) for bucketing, with equirectangular distance for the radius filter. Queries go through the bus as `{ spatial_query: { near: [lon,lat], radius } }` and use the first-responder pattern to return results directly to the caller. Direct access via `bus.spatial.query()` also works.

