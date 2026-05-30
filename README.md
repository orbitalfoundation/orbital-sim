# simulate

A modular agent-simulation workspace. A minimal pub/sub kernel runs scenarios composed of declarative manifests and small agent files.

## Structure

```
sim-core/           kernel, manifest loader, tick driver, CLI
scripts/            fetch-data.mjs — downloads declared assets into scenario .data/
public/             scenarios (one dir per author/scenario)
  anselm/
    planetary/      baseline: elevation, insolation, world grid, report
sim-core-claude/    predecessor engine — preserved as reference, not used
public-anselm-old/  archived scenarios (microeconomy, oil-trade, tuvalu)
notes/              design notes
wiki/               longer-form docs
```

## How it works

**`sim-core`** provides three things:

1. **`createSim()`** — a pub/sub resolver chain. Agents are objects with a `resolve(event, sim)` method. Events are plain objects: `{ tick, t, dt }`, `{ load, manifest }`, `{ remove: id }`. Filters are shallow key-existence checks; ordering via `resolve.before` / `resolve.after`.
2. **`loadManifest(path)`** — ESM files; every named export is an entry (arrays flattened). Entries with `ref` dynamic-import a template and merge overrides. Installs `sim.scenario` (dir, dataDir, assets, assetPath, requireAsset).
3. **`runTicks(sim, { ticks, dt })`** — opt-in tick driver.

`sim` is passed to every resolver call — not on `globalThis` — so multiple sims can run in parallel and tests are fully isolated.

## Running

```sh
# kernel sanity check (no I/O)
node sim-core/test/smoke.js

# empty manifest
node sim-core/src/run.js sim-core/test/empty-manifest.js --ticks 3 --dt 60

# planetary baseline — 4 ticks of 6 h walks the sun around the planet
node sim-core/src/run.js public/anselm/planetary/manifest.js --ticks 4 --dt 21600

# list assets any scenario declares
node scripts/fetch-data.mjs --list
```

Verified: June solstice noon UTC peak at 30°N is 1308 W/m² (Cooper 1969).

## Assets

Scenarios declare data files in their manifest with `kind: 'asset'`. Run `scripts/fetch-data.mjs` to download them into each scenario's `.data/` (gitignored, sha256-validated). Agents call `sim.scenario.requireAsset(name)` — never raw `fs`.

## Reserved vocabulary

| Category | Keys |
|---|---|
| Registered objects | `id, ref, resolve, parent, children` |
| Events | `tick, t, dt, load, remove, done, force_sys_abort` |
| Manifest exports | `meta` (scenario metadata, not an entry) |
| Entry kinds | `agent` (default), `asset` |

## What's next

1. Real elevation — replace synthetic cosine in `elevation.js` with a GEBCO raster lookup via a `sim.raster` service.
2. Atmospheric absorption — Beer–Lambert clear-sky transmissivity agent, then `radiation_balance`.
3. Agent spatial index — `sim.agents` service bucketing positioned entities by cell.
4. Snapshotting / replay — JSONL event log agent; replay is free from pub/sub.
