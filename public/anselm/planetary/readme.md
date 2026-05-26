# planetary

A pack of self-contained agents for the abiotic basics — sun, surface, air,
water — that everything else in a simulation lives on top of.

> 20260525: first pass on geophysical fabric — solar forcing, elevation,
> hydrology, atmosphere. The very basics.

## How an agent in here is shaped

These agents are **field-style processes**, not per-entity agents like the
`tuvalu/baseline/goat.js` pattern. A planetary agent is a single object that
reads and writes named fields over a grid of cells (S2 in production; a tiny
hand-rolled grid in the sketches here).

The contract every agent honours:

```js
export default {
  id:     'insolation',                  // unique name
  label:  'Top-of-atmosphere ...',       // human description
  reads:  [],                            // field names it consumes
  writes: ['tsi_w_m2'],                  // field names it produces

  init({ world, params }) {              // optional, called once
    // populate quasi-static fields, allocate buffers, etc.
  },

  step({ world, dt }) {                  // called every tick
    for (const cell of world.cells()) {
      world.setField(cell.token, 'tsi_w_m2', ...);
    }
  }
};
```

`world` is the shared field registry — it owns the cell list, the clock, and
one `Map<cellToken, value>` per field name. Agents communicate **only**
through named fields. They never import each other.

That's the modularity story: you swap any agent for another that writes the
same fields, and downstream agents don't notice. Someone else's
`hydrology.js` can replace mine as long as it writes `discharge_m3s`.

## What's here

| File | Reads | Writes |
|---|---|---|
| [`world.js`](agents/world.js) | — | the field-registry contract (would live in `shared/` in production) |
| [`insolation.js`](agents/insolation.js) | — | `tsi_w_m2` |
| [`elevation.js`](agents/elevation.js) | — | `elevation_m` |
| [`example-tick.js`](agents/example-tick.js) | both | runnable end-to-end demo |

Try it:

```sh
node public/anselm/planetary/agents/example-tick.js
```

Expected: at 2026-06-21T12:00Z (northern summer solstice, solar noon at
Greenwich) the 30°N / 0°E cell peaks around 1300 W/m², the equator at noon is
~1200, and cells at ±120° lon are dark or near-dark.

## A note on the divergence from the existing engine

The existing [`sim-core-claude`](../../../sim-core-claude/) engine schedules
**one agent per entity** with positional state — perfect for goats and
people. Field-style planetary agents don't fit that shape: there's one
`insolation` process, not 4 million per-cell instances.

So these sketches assume a **field-registry layer** that doesn't exist yet
in the engine. The contract is small (see [`world.js`](agents/world.js)) and
should eventually move to `public/shared/` so any agent pack can use it.

Both styles can coexist: a goat agent could read `world.getField(cellAt(self.position), 'tsi_w_m2')` to know how much sun it's standing in.

## Planned agents (sketch only — not built yet)

In rough dependency order. Listing as a map so future agents know what
field names to write/read.

| Agent | Reads | Writes |
|---|---|---|
| `orbit`              | (clock)                                          | `sub_solar_point`, `solar_distance_au` |
| `rotation`           | (clock)                                          | `local_solar_time`, `coriolis_f` |
| `lunar`              | (clock)                                          | `sub_lunar_point` |
| **`insolation`** ✓   | —                                                | `tsi_w_m2` |
| **`elevation`** ✓    | —                                                | `elevation_m` |
| `bathymetry`         | —                                                | `ocean_depth_m` |
| `land_cover`         | `elevation_m`                                    | `surface_type` |
| `albedo`             | `surface_type`, `ice_thickness_m`, `cloud_fraction` | `albedo` |
| `radiation_balance`  | `tsi_w_m2`, `albedo`, `temp_k`                   | `net_radiation_w_m2` |
| `atmosphere`         | `net_radiation_w_m2`, `elevation_m`              | `temp_k`, `pressure_pa`, `humidity` |
| `wind`               | `pressure_pa`, `coriolis_f`                      | `wind_u_v_ms` |
| `clouds`             | `humidity`, `wind_u_v_ms`                        | `cloud_fraction` |
| `precipitation`      | `clouds`, `temp_k`                               | `precip_mm` |
| `tides`              | `sub_lunar_point`, `ocean_depth_m`               | `tide_m` |
| `rivers`             | `elevation_m`, `precip_mm`                       | `discharge_m3s` |
| `cryosphere`         | `temp_k`, `precip_mm`                            | `ice_thickness_m` |

Cycles (atmosphere ↔ clouds ↔ radiation, albedo ↔ cryosphere) are resolved
by reading **last tick's** value and writing **this tick's** — same trick
real GCMs use.
