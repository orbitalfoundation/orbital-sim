# sim-core

A minimalist pub/sub kernel + manifest loader for agent simulations.
Descended from [orbital-sys](https://github.com/orbitalfoundation/orbital-sys).

## Design

- **One kernel function**: `sim.resolve(event)` walks a chain of registered
  resolvers, calling each whose filter matches.
- **Agents are objects** with a `resolve(event, sim)` method. Tick is just
  another event: `{ tick, t, dt }`. Loading is just another event:
  `{ load: 'manifest', count, ... }`. Removal is just another event:
  `{ remove: id }`.
- **Manifests are ESM files**. Every named export is treated as an agent
  entry; arrays are flattened one level. The reserved export `meta` carries
  scenario metadata. JSON support is deferred.
- **Agent templates** live in their own files and are referenced from
  manifests via `ref: './path/to/agent.js'`. The manifest entry's properties
  shallow-override the template, so you can configure an agent without
  forking it.
- **State is not cloned**. Resolvers may mutate events in place.
- **Ordering hints** via `resolve.before = 'other-id'` and
  `resolve.after = 'other-id'` (single-level, best-effort topological).

Reserved keys on registered objects: `id, ref, resolve, parent, children`.
Reserved keys on events: `tick, t, dt, load, remove, done, force_sys_abort`.
Reserved manifest export: `meta` (scenario metadata).
Reserved entry kinds: `agent` (default), `asset`.

## Scenario namespace

When a manifest is loaded, `sim.scenario` is populated with:

- `dir` — absolute path to the manifest's directory
- `dataDir` — `<dir>/.data` (gitignored; populated by `scripts/fetch-data.mjs`)
- `meta` — the manifest's `meta` export
- `assets` — `Map<name, asset entry>` from `kind: 'asset'` entries
- `assetPath(name)` — absolute path inside `dataDir`
- `hasAsset(name)` — boolean fast stat
- `requireAsset(name)` — returns path, throws with a fetch hint if missing

Agents query this instead of doing filesystem archaeology.

## Assets

Declared in the same manifest as agents, using `kind: 'asset'`:

```js
export const gebco = {
  kind: 'asset',
  name: 'gebco-2024',
  target: 'elevation/gebco-2024.u16',
  url: 'https://...',
  sha256: '...',
}
```

`scripts/fetch-data.mjs` walks scenario manifests, downloads what's missing
into each scenario's own `.data/`, and validates by sha256.

## Usage

```js
import { createSim, loadManifest, runTicks } from './sim-core/index.js'

const sim = createSim()
await loadManifest(sim, '/abs/path/to/manifest.js')
runTicks(sim, { ticks: 10, dt: 3600 })
```

Or from the CLI:

```sh
node sim-core/bin/run.js public/anselm/planetary/manifest.js --ticks 4 --dt 21600
```

## Manifest example

```js
// my-scenario/manifest.js
export const meta = { name: 'my scenario' }

export const world = {
  ref: './agents/world.js',
  lats: [-60, -30, 0, 30, 60],
}

export const goats = Array.from({ length: 12 }, (_, i) => ({
  ref: './agents/goat.js',
  id: `goat-${i}`,
  position: { lat: -8.5 + i * 0.01, lon: 179.2 },
}))
```

## Agent example

```js
// agents/insolation.js
export default {
  id: 'insolation',
  resolve(event, sim) {
    if (!event.tick) return
    // ...compute irradiance, write to sim.world.setField(...)
  },
}
```

## Layout

```
sim-core/
  index.js              public API
  lib/
    sys.js              kernel: register, resolve, filters, ordering
    load.js             import manifest, unroll exports, merge with templates
    tick.js             tick driver (runTicks, startTicker)
  bin/
    run.js              CLI
  test/
    smoke.js            no-I/O kernel sanity check
    empty-manifest.js   smallest possible manifest
```

## Status

- v0.1 — pub/sub kernel, JS manifest loader, tick driver, CLI
- The predecessor `sim-core-claude/` is preserved as a reference but not used.
