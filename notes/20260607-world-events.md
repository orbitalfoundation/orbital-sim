# World events, geo-intelligence, and the bus query protocol — June 7 2026

Backtracked a bit away from hormuz - to get some basic data ingestion in and test.
Will then go back to hormuz once we have some data.

Session log. Started focused on the Strait of Hormuz simulation, then
broadened into data ingestion infrastructure, globe visualization, and a
foundational architectural clarification.

---

## Strait of Hormuz simulation

**`public/orbital/hormuz/`** — the project's first genuinely agent-based model,
and a meaningful test of the simulation architecture.

Unlike IPCC (one global EBM producing a temperature field), Hormuz is a
**network flow model**: commodities move through nodes along edges, disruption
at one node propagates downstream. The distinction shapes everything: agent
types, data needed, visualization.

### The cascade proof

Six agents, one `BLOCKADE` parameter (0–1), all second-order effects fall out
from the structure without hand-programming:

```
BLOCKADE → flows.js → energy.js → fertilizer.js → agriculture.js → food-security.js
                    ↘ helium.js
```

At `BLOCKADE=0.8`, 12 weekly ticks:
- Oil flow falls to 25%, recovers to 42% as bypass routes ramp up
- LNG-JKM spikes to ~$69/MMBtu (from $12 baseline)
- Fertilizer plants collapse to 10% utilization (LNG price above Haber-Bosch economics)
- Urea price +92%, N-application down to 72%, wheat yield 85%
- 450–1000M people at acute food risk; Bangladesh and Pakistan hardest hit

The "cascade falling out magically" is the proof of concept: **the system is
structurally correct when you only have to reduce one number and the rest follows**.

### Helium — the most non-obvious cascade

Qatar produces 32% of global helium as a byproduct of LNG processing at Ras Laffan.
Helium cannot be stockpiled: it boils off from ISO containers in ~45 days.
When LNG flow drops below 15%, Qatar helium goes offline and the boiloff clock
starts. Semiconductor fabs (TSMC, Samsung, SK Hynix), MRI machines, and aerospace
are directly affected. South Korea sources 65% of industrial helium from Qatar.

This is modelled in `helium.js` with a `_stranded_vol` accumulator and a boiloff
decay function. The 45-day window is not a soft deadline — it is permanent supply
destruction.

### Data files created

In `public/orbital/hormuz/data/`:
- `routes.json` — 6 routes: Hormuz strait, Suez, Cape, Saudi Petroline, Abu Dhabi-Fujairah, Iraq-Turkey pipelines
- `oil-fields.json` — 16 named Gulf fields and terminals with coordinates, production, bypass availability
- `lng-and-helium.json` — LNG terminals, helium sources, boiloff mechanics, consumer breakdown by sector
- `fertilizer-plants.json` — QAFCO, SABIC Jubail, Fertiglobe, OMIFCO; the gas→ammonia cascade chain
- `refineries.json` — 13 major refineries dependent on Gulf crude with coordinates and Gulf fraction
- `countries.json` — 20 countries with oil/LNG/fertilizer import dependency, food import %, strategic reserve days

### Run commands

```bash
# Baseline
node packages/bus/run.js public/orbital/hormuz/manifest.js --ticks 52 --dt 604800

# 80% closure
BLOCKADE=0.8 node packages/bus/run.js public/orbital/hormuz/manifest.js --ticks 52 --dt 604800
```

### Open todos

- Brent at $281/bbl at 80% closure is probably too high — price elasticity of 4.0 is at
  the upper bound. The Commodity Context article documented 12-14% oil lost over 3 months,
  implying more modest effective disruption. Calibrate against observed 2026 price data.
- Helium agent triggers at >15% LNG flow — requires ~90% closure to go fully offline.
- Second-order cascade from Hormuz to food: add to the general stress layer shared with IPCC.
- Place-based agents (cities, populations) deferred — need more geo data sources first.
- De-duplication of conflict events across sources: deferred, noted as future work.

---

## Geo-intelligence infrastructure

### Agent soup pattern confirmed

The key architectural decision: ingestion agents are bus agents, not separate processes.
There is no special "ingestion" concept. An ACLED agent, a cities agent, a commodity-price
agent — they all follow the same `resolve()` pattern:
- `registered` → open SQLite, check TTL, start background sync, install `bus.X` service
- `tick` → check wall-clock time, trigger re-sync if stale (realtime mode only)
- `*_query` → handle incoming query event, return result from SQLite

This matches the Unix process model: there is one kind of thing (processes, agents), and
the OS/bus doesn't care what the process does. No special process type for scrapers.

### Stale-while-revalidate (SWR) pattern

All ingestion agents follow this pattern (named from HTTP Cache-Control):
1. Serve existing data immediately (from SQLite) — never block
2. Check TTL against wall-clock time
3. Trigger background refresh when stale, fire-and-forget
4. Atomic swap when refresh completes (`_data = newData` — safe in single-threaded Node.js)
5. On failure: keep serving stale data, log warning, retry next cycle

Industry references: browser service workers, Redis TTL, React Query / SWR library,
Prometheus scrape intervals, Airflow idempotent transforms.

**Key insight:** In batch mode (76 ticks in 20 seconds), `Date.now()` doesn't advance
meaningfully so SWR never fires — correct. In realtime mode (running for hours), it
does fire — also correct. Same code, both modes handled.

### Double-buffering for atomic file writes

File cache writes use `.tmp` → atomic rename (same pattern as snapshot.js):
```javascript
await writeFile(path + '.tmp', data);
await rename(path + '.tmp', path);  // atomic on POSIX
```
Readers always see either the old file or the new one, never a partial write.

### Module-level singleton pattern

The same pattern that solved the 18MB GEBCO raster problem (load once, share across
all concurrent bus instances) applies to all ingestion agents:
- SQLite connection: module-level `_db` in `packages/agents/lib/db.js`
- Sync state: module-level `_syncing`, `_lastSync` per agent
- Five concurrent Hormuz buses share one DB connection and one sync cycle

This is free in Node.js because all buses run in the same process.

### SQLite spatial queries

Settled on standard SQLite (no SpatiaLite) with a bounding box pre-filter + haversine
in JavaScript:

```sql
SELECT * FROM events WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?
```

Then exact distance in JS on the smaller result set. This is the
"bounding box pre-filter + precise in-memory filter" pattern. Efficient at
our data volumes (ACLED ~500K events, GDELT ~90-day window). SpatiaLite deferred
until genuine need for polygon queries or distance indexing.

### Data sources

| Agent | Source | Auth | Updates | Notes |
|---|---|---|---|---|
| `acled.js` | ACLED API | Key (weeks approval) | Daily | Best quality; wait for it |
| `gdelt.js` | GDELT 2.0 | None | 15 min | Real-time; noisy; covers 2026 crisis |
| `ucdp.js` | UCDP GED | None | Annual | Historical 1989–2023; very high quality |
| `cities.js` | GeoNames | None | Monthly | 24K cities with population and coordinates |

ACLED approval process is slow (weeks for researchers). GDELT and UCDP are immediately
usable. The agents are in `packages/agents/ingestion/`.

---

## World events globe

**`public/orbital/world-events/index.html`** — standalone Three.js globe page.

Key features:
- **OrbitControls** — drag to rotate, scroll to zoom, damping for feel
- **Stars and atmosphere glow** — subtle but gives depth
- **Slow auto-rotation** when idle; pauses when user interacts, resumes after 8s
- **Event points** — custom vertex shader so each point has individual size (∝ mentions or fatalities) and color (red = material conflict, amber = verbal conflict)
- **City dots** — GeoNames cities with pop > 500K shown as small teal markers
- **Time slider** — spans all dates in the DB; auto-advances 1 day/second in play mode
- **Source selector** — GDELT, UCDP, ACLED; detects available sources dynamically

The page queries all data via the bus query protocol (socket.io), not REST.
No data shows until at least one ingestion agent has populated the SQLite DB.

### On the long-term visualization path

The current Three.js globe is a reasonable first pass. The user maintains a NASA
globe renderer wrapper at https://github.com/orbitalfoundation/terratwin using
CesiumJS (Cesium satellite tile imagery). This would be a significant upgrade —
Cesium tiles are excellent — but requires a Cesium Ion token and a more complex
setup. The world-events page is standalone HTML, so swapping out Three.js for
Cesium would not touch any other code.

---

## The bus query protocol — removing barnacles

### The problem

Per-resource REST routes were being added for every new data type:
`/api/events`, `/api/events/dates`, `/api/events/sources`, `/api/cities`.
Each was a new Fastify route importing a new server-side module (events.js)
that duplicated SQLite query logic already in the agents. This is the barnacle
pattern: each addition creates new surface the developer must learn.

### The fix

**worldBus** — a persistent bus (server lifetime) started in `sims.js` that holds
all infrastructure agents. Loads `public/orbital/world/manifest.js` at startup.

**Socket query protocol** — one handler replaces N routes:
```javascript
// Client
function busQuery(key, args) {
  return new Promise(resolve => {
    const id = Math.random().toString(36).slice(2);
    socket.once(`response:${id}`, ({ ok, result }) => resolve(result));
    socket.emit('query', { id, key, args });
  });
}

// Usage — any service, same call
const cities = await busQuery('cities_query', { largest: 500 });
const events = await busQuery('gdelt_query',  { date: '2026-06-07' });
```

Security boundary: only `*_query` keys are permitted through the socket handler —
data queries, not actions.

**Removed:** `website/server/events.js`, `better-sqlite3` from server package,
all four barnacle REST routes.

### The principle

Captured in `CLAUDE.md` under "Engineering principles":

Before implementing a new feature, ask:
1. Does this expand the total surface area a developer must understand?
2. Is there an existing architectural system that can absorb this?

A new data source → new agent with `*_query` handler, not a new route.
A new scenario → new manifest, not new server code.
REST stays correct only for lifecycle operations (start/stop sim).

---

## Remaining open questions

**De-duplication across event sources.** ACLED, GDELT, and UCDP will all cover
the same real-world events with different identifiers, slightly different locations,
and different dates (reporting lag). Not implemented yet. When ACLED arrives and
overlaps with GDELT, a `canonical_events` view fingerprinted by
(date ± 1 day, lat/lon ± 0.5°, event root code) would reduce obvious duplicates.

**Admin logging and size limits.** No admin panel. Currently: stdout captured by
Docker logs. SQLite tables have no row cap — if GDELT runs globally and accumulates
for months, tables can grow large. Simple fix: configurable `max_rows` with
oldest-first pruning. Deferred.

**GDELT global vs. regional scope.** Current GDELT agent filters to Gulf FIPS codes.
For the world-events globe, a wider region or global scope would be more visually
compelling but increases data volume significantly. GDELT daily files are ~50KB
compressed filtered to conflict; unfiltered are much larger.

**Next simulation focus.** Hormuz is the next scenario to develop further. The model
runs and cascades correctly, but lacks:
- Visual representation of the nodes (oil fields, refineries, ports on a globe)
- Place-based agents that translate temperature/price signals to population impact
- Real calibration against observed commodity price data from the 2026 crisis
- The second-order stress layer shared with IPCC (both eventually converge on food/fuel price → population outcomes)
