# @orbital/bus

A late-binding, declarative event bus for agent simulations. Descended from [orbital-sys](https://github.com/orbitalfoundation/orbital-sys).

`bus.resolve()` is the single entry point for everything: registering handlers, dispatching events, and querying services. Almost nothing is declared ahead of time. The application assembles itself at runtime from manifests — manifests can load other manifests recursively — each one publishing agents that register themselves, claim their namespace via schema events, and install services onto `bus` (e.g. `bus.volume`, `bus.world`). The result is a real-time compilation of cooperating services, all wired through one channel.

`bus.resolve()` is also a query mechanism. Resolvers that return a value stop the chain and hand the result back to the caller:

```js
// fire-and-forget — all matching handlers run
await bus.resolve({ tick: 1, t: 3600, dt: 3600 })

// query — first handler with an answer wins, chain stops
const nearby = await bus.resolve({ volume_query: { lat: 10.2, lon: -61.5, radius: 500 } })
```

## Quick start

```sh
npm test                                                        # test suite
node test/smoke.js                                              # kernel smoke test
node src/run.js test/empty-manifest.js --ticks 3 --dt 60       # empty manifest
node src/run.js public/anselm/planetary/manifest.js --ticks 4 --dt 21600
```

## Usage

```js
import { createBus } from '@orbital/bus'

const bus = createBus()
await bus.resolve({ load: 'manifest', manifest: '/abs/path/to/manifest.js' })
// tick manually or use runTicks from ./src/tick.js
```

## Design

- `bus.resolve(event)` walks registered resolvers; each whose filter matches is called in order.
- Agents are objects with `resolve(event, bus)`. Tick: `{ tick, t, dt }`. Load: `{ load: 'manifest', manifest }`. Remove: `{ resolve_remove: id }`.
- Manifests are ESM files. Named exports are agent entries (arrays flattened).
- `ref: './path/to/agent.js'` dynamic-imports a template; manifest entry properties shallow-override it.
- State is not cloned. Resolvers may mutate events in place.
- Ordering: `resolve.before` / `resolve.after` (id references, best-effort topological).

## Reserved vocabulary

| | keys |
|---|---|
| Registered objects | `id, ref, resolve, parent, children` |
| Events | `tick, t, dt, load, resolve_remove, done, force_sys_abort` |
| Manifest exports | `meta` (scenario metadata, not an entry) |
| Entry kinds | `agent` (default), `asset` |

## Scenario namespace

After loading a manifest, `bus.scenario` provides:

- `dir`, `dataDir` (`<dir>/.data`, gitignored)
- `meta` — manifest's `meta` export
- `assets` — `Map<name, entry>` for `kind: 'asset'` entries
- `assetPath(name)`, `hasAsset(name)`, `requireAsset(name)` — path helpers; `requireAsset` throws with a fetch hint if missing

## Manifest example

```js
export const meta = { name: 'my scenario' }

export const world = { ref: './agents/world.js', lats: [-60, -30, 0, 30, 60] }

export const goats = Array.from({ length: 12 }, (_, i) => ({
  ref: './agents/goat.js',
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
