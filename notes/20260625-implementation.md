# 2026-06-25 notes

## code that we need:

- a core event bus pattern - similar to the github.com/orbitalfoundation pattern
    - pass events to all observers
    - observers that can store things in a spatial hash is a special need
    - obliterate -> an event
    - observer registration -> an event
    - an onstep() -> this can actually just be an event
    - arguably an oninit() -> may need a bit more thought

- spatial indexing
- some agents for dealing with geophysical or planetary phenomena
- tests

## what we built:

A new minimal core: **`sim-core/`**. Replaces the per-entity engine in
`sim-core-claude/` (preserved as a reference, not used).

Three ideas, one kernel:

1. **`createSim()`** — a pub/sub resolver chain. Agents are objects with a
   `resolve(event, sim)` method. Tick is just `{tick, t, dt}`. Load is just
   `{load, manifest, ...}`. Removal is just `{remove: id}`. Filters are
   shallow key-existence checks (`resolve.filter = {tick: true}`). Ordering
   hints via `resolve.before` / `resolve.after`.
2. **`loadManifest()`** — manifests are ESM files. Every named export is an
   entry; arrays are flattened. Each entry is routed by `kind` (`agent` by
   default, or `asset`). Agent entries with a `ref` dynamic-import the
   template and shallow-merge entry overrides on top.
3. **`sim.scenario`** — installed at load. Carries `dir`, `dataDir`, `meta`,
   and `assets` plus `assetPath/hasAsset/requireAsset`. Scoped to the
   scenario, so agents can introspect their own local environment without
   ad-hoc filesystem archaeology.

## design choices we settled today

- **Inject, don't globalise**: `sim` is passed to every `resolve(event, sim)`
  call; not on `globalThis`. Lets us run multiple sims, test in isolation,
  swap services in mocks.
- **Naming**: `sim` is the host-services bag (kernel, scenario, services
  agents register). `world` (when present) is just one such service, holding
  simulated state (cells, fields, clock) — installed by the `world` agent in
  planetary, not core.
- **State is not cloned**. Resolvers may mutate in place. Revisit if it bites.
- **Tick driver lives in core but is opt-in** — `runTicks(sim, {ticks, dt})`.
- **No live filesystem reflection**. Agents call `sim.scenario.requireAsset()`,
  which returns a path or throws with a fetch hint. No agent ever calls
  `fs.readdir`.
- **No parallel formalism** for data manifests. Assets are declared as
  `kind: 'asset'` entries alongside agents in the same manifest. One loader,
  one file format.
- **Scenario-scoped assets**: each scenario fetches into its own `.data/`.
  Deduplication via a content-addressed cache is a later optimisation, kept
  behind `assetPath()` so agents don't change.

## what's on disk

```
sim-core/
  src/sys.js          kernel: register, resolve, filters, ordering
  src/load.js         manifest loader + sim.scenario
  src/tick.js         runTicks, startTicker
  src/run.js          CLI
  test/smoke.js       no-I/O kernel sanity check
  test/empty-manifest.js
  README.md

scripts/fetch-data.mjs   walks public/*/*/manifest.js, downloads kind:'asset'
                         entries into each scenario's .data/, sha256-validated

public/anselm/planetary/
  manifest.js                 4 agents + 1 placeholder asset (gebco-2024)
  agents/world.js             installs sim.world (cells, fields, clock) on load
  agents/elevation.js         fills elevation_m on load (synthetic cosine for now)
  agents/insolation.js        writes tsi_w_m2 each tick (Cooper 1969)
  agents/report.js            prints the field table per tick
```

## what runs

```sh
# kernel sanity
node sim-core/test/smoke.js

# empty boring scenario
node sim-core/src/run.js sim-core/test/empty-manifest.js --ticks 3 --dt 60

# planetary baseline — 4 ticks of 6h walks the sun around the planet
node sim-core/src/run.js public/anselm/planetary/manifest.js --ticks 4 --dt 21600

# list assets any scenario wants
node scripts/fetch-data.mjs --list
```

Verified: June solstice noon UTC peak at 30°N is 1308 W/m², matches the
original hand-written `example-tick.js` to the watt.

## reserved vocabulary

- registered objects: `id, ref, resolve, parent, children`
- events: `tick, t, dt, load, remove, done, force_sys_abort`
- manifest exports: `meta` is scenario metadata, not an entry
- entry kinds: `agent` (default), `asset`

## what we cleaned up

Three commits today on `main`:
- `archive`: old `src/{simulation_engine,twitter_scanner}` + old
  `public/anselm/{microeconomy,oil-trade,tuvalu}` scenarios moved to
  `public-anselm-old/` / `sim-core-claude/`; schema-scanner absorbed
  (was a nested git repo); notes + wiki updates
- `scenarios`: planetary baseline, tenerife-futures sketch, shared
  schema-components
- `sim-core`: kernel, loader, tick, CLI, asset convention, fetch script,
  `.gitignore` updated to ignore `public/*/*/.data/`

Not pushed (no remote yet, and pushing is opt-in anyway).

## what's next

In rough order:

1. **Real elevation substrate** — replace the synthetic `sample(cell)` in
   `elevation.js` with a real lookup against GEBCO. Either:
   - fetch GEBCO, write a `raster.js` service that mmaps it and registers
     `sim.raster.elevation`, then have `elevation.js` consume it; or
   - more incremental: write a small local raster for one region first
     (Tuvalu? Tenerife?) and prove the pattern.
2. **Atmospheric / surface absorption** — once elevation is real, layer in a
   simple atmosphere agent (Beer–Lambert per cell, fixed clear-sky
   transmissivity), then `radiation_balance` (insolation × (1 − albedo)).
   Will be wrong in detail but right in shape.
3. **Agent spatial index** — a separate service registered as `sim.agents`,
   reading positions and bucketing by cell. Lets per-entity agents (a goat,
   a person) coexist with field agents.

## tensions noted, not yet resolved

- Whether `sim.world` should be in core or stay as a per-scenario agent
  convention. Currently the latter; feels right while we have one substrate.
- Whether to keep mutating events in place or introduce optional cloning
  for cross-process / cross-thread / untrusted-agent scenarios.
- How to surface scenario discovery (a list-all command) without inventing
  yet another manifest registry.
