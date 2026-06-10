# orbital/planetary

@todo June 7 2026 - this is still a work in progress, we ended up focusing on ../IPCC first and will circle back to this. The goal here is a larger simulation beyond merely warming, to explore other geological processes.

Abiotic baseline agents — solar forcing, elevation, surface fields — that
other simulations build on top of. Each agent is a field-style process: one
object that reads and writes named fields over a grid of `bus.world` cells.

## Quick start

Both manifests are run via `packages/bus/run.js`. From the project root:

```sh
# Insolation only — no external data, runs immediately.
# 4 ticks of 6 h each walks the sun around the planet for one full day.
node packages/bus/run.js public/orbital/planetary/manifest.js --ticks 4 --dt 21600

# Elevation + insolation — requires GEBCO data (see below).
node packages/bus/run.js public/orbital/planetary/manifest-gebco.js --ticks 4 --dt 21600
```

## Manifests

| File | What it runs | External data |
|---|---|---|
| [`manifest.js`](manifest.js) | `world` + `insolation` + `report` | none |
| [`manifest-gebco.js`](manifest-gebco.js) | above + `elevation` (GEBCO raster) | GEBCO 2024 |

## Getting GEBCO elevation data

1. Download GEBCO 2024 (15 arc-second global grid) from https://www.gebco.net/
2. Convert to a raw little-endian `Int16` raster and save as
   `public/.data/elevation/gebco-2024.u16`
3. Fill in `url`, `sha256`, and `bytes` in `manifest-gebco.js`
4. Or run `node scripts/fetch-data.mjs public/orbital/planetary/manifest-gebco.js`
   once the url is set — it will download and verify automatically.

Until real data is present, `elevation_m` falls back to a cosine
approximation (`1000 * cos(lat)`).

## Agents

| Agent | Reads | Writes |
|---|---|---|
| [`insolation.js`](agents/insolation.js) | `bus.world` (time, cells) | `tsi_w_m2` |
| [`elevation.js`](agents/elevation.js) | `bus.world`, `bus.elevation` | `elevation_m` |
| [`report.js`](agents/report.js) | named fields via `bus.world` | (console output) |

## Planned agents

In rough dependency order:

| Agent | Reads | Writes |
|---|---|---|
| `albedo` | `surface_type`, `ice_thickness_m` | `albedo` |
| `radiation_balance` | `tsi_w_m2`, `albedo`, `temp_k` | `net_radiation_w_m2` |
| `atmosphere` | `net_radiation_w_m2`, `elevation_m` | `temp_k`, `pressure_pa`, `humidity` |
| `wind` | `pressure_pa` | `wind_u_v_ms` |
| `clouds` | `humidity`, `wind_u_v_ms` | `cloud_fraction` |
| `precipitation` | `clouds`, `temp_k` | `precip_mm` |
| `rivers` | `elevation_m`, `precip_mm` | `discharge_m3s` |
| `cryosphere` | `temp_k`, `precip_mm` | `ice_thickness_m` |
