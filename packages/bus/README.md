# @orbital/bus

A late-binding, declarative event bus for agent simulations. Descended from [orbital-sys](https://github.com/orbitalfoundation/orbital-sys).

`bus.resolve()` is the single entry point for everything: registering handlers, dispatching events, and querying services. Almost nothing is declared ahead of time. The application assembles itself at runtime from manifests — each one publishing agents that register themselves, claim their namespace via schema events, and install services onto `bus` (e.g. `bus.spatial`, `bus.world`). The result is a real-time compilation of cooperating services, all wired through one channel.

`bus.resolve()` is also a query mechanism. Resolvers that return a value stop the chain and hand the result back to the caller:

```js
// fire-and-forget — all matching handlers run
await bus.resolve({ tick: 1, t: 3600, dt: 3600 })

// query — first handler with an answer wins, chain stops
const nearby = await bus.resolve({ spatial_query: { near: [-61.5, 10.2], radius: 500 } })
```

## Quick start

```sh
npm test
node packages/bus/run.js public/anselm/planetary/manifest.js --ticks 4 --dt 21600
```

## Usage

```js
import { createBus } from '@orbital/bus'

const bus = createBus()
await bus.resolve({ load: '/abs/path/to/manifest.js' })
await bus.resolve({ run: true, ticks: 4, dt: 21600 })
```

## Design

- `bus.resolve(event)` walks registered resolvers; each whose filter matches is called in order.
- Agents are objects with `resolve(event, bus)`. Tick: `{ tick, t, dt }`. Load: `{ load: 'path' }`. Remove: `{ id, obliterate: true }`.
- Manifests are ESM files. Named exports are agent entries (arrays flattened).
- `inherits: './path/to/agent.js'` dynamic-imports a template; manifest entry properties shallow-override it.
- State is not cloned. Resolvers may mutate events in place.
- Ordering: `resolve.before` / `resolve.after` (id references, best-effort topological).
- Services self-install via `bus.install(name, service)` on their `registered` event.

## Reserved vocabulary

| | keys |
|---|---|
| Registered objects | `id, inherits, resolve` |
| Events | `tick, t, dt, load, run, obliterate, registered, schema, done, force_sys_abort` |

## Manifest example

```js
export const world = {
  inherits: '@orbital/world',
  lats: [-60, -30, 0, 30, 60],
  lons: [-120, 0, 120],
  t0: '2026-06-21T12:00:00Z',
}

export const goats = Array.from({ length: 12 }, (_, i) => ({
  inherits: './agents/goat.js',
  id: `goat-${i}`,
  position: { lat: -8.5 + i * 0.01, lon: 179.2 },
}))
```

## Agent example

```js
export default {
  id: 'insolation',
  resolve(event, bus) {
    if (!event.tick) return
    // compute irradiance, write to bus.world.setField(...)
  },
}
```
