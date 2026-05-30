# simulate

A modular agent-simulation workspace. A minimal pub/sub kernel runs scenarios composed of declarative manifests and small agent files.

## Structure

```
packages/
  bus/        pub/sub kernel — createBus(), manifest loader, tick driver, schema registry
  spatial/    geographic indexing — bus.spatial, ll/llextent, proximity queries
  world/      cell grid + field store — bus.world, setField/getField
  utils/      shared logger + mulberry32 PRNG
public/
  anselm/
    planetary/  baseline scenario: elevation, insolation, world grid, report
notes/          design notes
```

## How it works

`bus.resolve(event)` is the single entry point. Agents are objects with `resolve(event, bus)`. The bus walks its resolver list; handlers whose filter matches are called in order. A handler that returns a non-undefined value stops the chain — this doubles as a query mechanism.

Manifests are ESM files. Each named export becomes an entry. Entries with a `resolve` function are registered as agents; all others are dispatched as bus events for component handlers to process. `inherits: './path/or/package'` loads a template and shallow-merges the entry on top.

```js
// fire-and-forget
await bus.resolve({ tick: 1, t: 3600, dt: 3600 })

// query — first handler with an answer wins
const nearby = await bus.resolve({ spatial_query: { near: [-122, 49], radius: 500 } })
```

## Running

```sh
npm test                    # run all package tests

# planetary baseline — 4 ticks of 6 h walks the sun around the planet
node packages/bus/run.js public/anselm/planetary/manifest.js --ticks 4 --dt 21600
```

## Reserved vocabulary

| | keys |
|---|---|
| Registered objects | `id, inherits, resolve` |
| Events | `tick, t, dt, load, obliterate, registered, done, run, schema` |

## Packages

**`@orbital/bus`** — kernel. `createBus()` returns a bus with `resolve`, `register`, `install`, `has`, `get`, `list`. Three built-in handlers auto-registered: manifest loader, schema handler, tick driver.

**`@orbital/spatial`** — geographic index. Register `spatialHandler`, then dispatch `{ id, spatial: { ll: [lon, lat, elev] } }` to index an entity. Query with `{ spatial_query: { near: [lon, lat], radius } }`.

**`@orbital/world`** — cell grid + field store. Use via `inherits: '@orbital/world'` in a manifest entry. Installs `bus.world` on registration.

**`@orbital/utils`** — `Logger` (default export) and `mulberry32(seed)` seeded PRNG.
