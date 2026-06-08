# @orbital/viz — visualization package design notes

June 2026.

---

## Why a separate package

The simulation engine (`packages/bus`, `packages/agents`) and the visualization
layer serve different audiences and evolve at different rates. A scenario author
who wants to visualize data doesn't need to know anything about the bus. A
visualization author shouldn't need to understand agent registration. Separating
them also makes the viz package publishable independently — it becomes a general
utility that any geospatial or data application can use, not just orbital-sim.

The broader vision: several packages in `packages/` may eventually be bundled
into something like `orbital-sys` (the simulation engine and agent infrastructure),
while visualization ships separately as `orbital-viz` under the owner's existing
`orbital` npm namespace.

---

## What was built

**`packages/viz/`** — standalone npm package, framework-agnostic.

Builds to `dist/` via `vite build --lib`. Three.js is a peer dependency —
consumers bring their own copy. Nothing framework-specific: no Svelte, no React.

### Exports

| Import path | Contents |
|---|---|
| `@orbital/viz` or `@orbital/viz/globe` | `createGlobe(container, options)` — 3D interactive globe |
| `@orbital/viz/chart` | `timeSeries`, `barChart`, `statCard` — Observable Plot wrappers |

### Globe

`createGlobe` is a factory that returns a minimal API:
```javascript
const globe = await createGlobe(container, { cesiumToken, mode, lat, lon });
globe.addPoints(id, [{ lat, lon, color, size }]);
globe.removePoints(id);
globe.focusOn(lat, lon, altitudeMetres);
globe.dispose();
```

Two modes based on token availability:
- **With Cesium Ion token**: uses `3d-tiles-renderer` to load Bing Maps satellite
  tiles (asset ID 2275207) from Cesium Ion. Real-world satellite imagery at
  excellent resolution. `GlobeControls` from `3d-tiles-renderer` for globe
  navigation.
- **Without token (fallback)**: plain Three.js sphere with an earth texture
  (`/assets/earth.jpg`), standard `OrbitControls`. Works offline, no account
  needed, slightly lower visual fidelity.

### Porting from terratwin

The original implementation in `orbitalfoundation/terratwin` was a React
component (`map-component.tsx`). The core engine setup — renderer, camera,
tiles registration, GlobeControls, animation loop — was already pure Three.js
with no React-specific logic. The React hooks (`useEffect`, `useRef`) were
just lifecycle wrappers. The port to vanilla JS was mechanical: async init
function instead of `useEffect`, refs replaced by closures, no framework
imports.

The terratwin author noted the NASA globe renderer was weak at the time but
the Cesium tile quality was excellent. The `3d-tiles-renderer` library has
continued to improve since.

### Charts

Observable Plot is loaded from CDN on first use — not bundled. This avoids
adding ~100KB to the package and lets consumers override the CDN version.
All charts apply Orbital's dark theme (CSS variable values as defaults):
`--accent` teal for primary series, `--border` for grid lines, `--text` for labels.

---

## What's planned

### Deck.gl geographic layers

The highest-value addition after the globe is Deck.gl for map data layers.
Deck.gl is purpose-built for data-intensive geographic visualization and handles
the cases the basic globe can't:

- **ArcLayer** — animated arcs between origin and destination (commodity flows
  for Hormuz, migration paths, shipping lanes). Thickness and color encode
  volume and type.
- **HexagonLayer / HeatmapLayer** — density visualization (population exposure,
  temperature anomaly field from IPCC).
- **GeoJsonLayer** — country borders, regions, polygons (choropleth for
  food insecurity scores).
- **ScatterplotLayer** — optimized for millions of points (faster than Three.js
  custom shaders at scale).

Deck.gl works over a MapLibre/Mapbox base map for 2D or can be used with
Three.js for 3D integration. It ships as a proper ES module and is CDN-available,
making it suitable for standalone scenario pages.

### Network/flow diagrams

For the circular arrangements with arrows the user described — agent
relationship graphs, supply chain flow, dependency trees:
- **D3-force** for flexible force-directed layouts (small to medium graphs)
- **Sigma.js** for large graphs (100K+ nodes)
- **D3-dag** for directed acyclic graphs (cascade diagrams)

For Sankey specifically: `d3-sankey` is a small, standalone module and the
right tool for flow quantities between stages (e.g., oil from wells → refineries
→ regions, or the Hormuz cascade: production → routes → consumers).

### Tooltip system

A shared tooltip utility that works with all the above — appears on hover,
shows structured data, follows the cursor. Not a component library (no shadows,
no animations) — just a positioned DOM element with consistent Orbital styling.

---

## Architecture principles for the package

**Framework-agnostic.** The viz package has no dependency on Svelte, React,
Vue, or any UI framework. Svelte components in the main app can wrap these
utilities in thin reactive shells; React components elsewhere can do the same.
The package itself doesn't know about either.

**Peer dependencies.** Three.js is a peer dep — consumers bring their own.
This prevents version conflicts when the parent app already has Three.js.
Deck.gl, Observable Plot, and D3 will be the same: peer or CDN, not bundled.

**Built once, used everywhere.** `npm run build` in `packages/viz/` produces
`dist/orbital-viz.js` and the per-module entries. Both standalone scenario
HTML pages (`public/orbital/*/index.html`) and the Svelte app import from
the same built output at `/orbital/viz/dist/`.

**Each module is independently importable.** `@orbital/viz/globe` doesn't
pull in chart dependencies and vice versa. Tree-shaking and separate entry
points keep the bundles minimal.

---

## npm publishing

The owner has the `orbital` npm namespace. Candidate name: `orbital-viz`.

```bash
# In packages/viz/package.json, change name to:
"name": "orbital-viz"

# Then:
npm publish --access public
```

The monorepo uses `@orbital/viz` internally (workspace alias). The published
package would be `orbital-viz`. If a scoped name is preferred: `@orbital/viz`
requires the `@orbital` npm organization to be registered.

The simulation engine packages (`@orbital/bus`, `@orbital/agents`, etc.) may
eventually ship together as `orbital-sys` or a similar bundled package — separate
from viz since their audiences differ.

---

## Migration path for existing globes

Two existing Three.js globe implementations currently in the repo:

1. **`website/client/src/lib/Globe.svelte`** — home page background globe.
   Renders a rotating earth with city markers. Will become a thin Svelte wrapper:
   ```svelte
   <script>
     import { createGlobe } from '@orbital/viz/globe';
     // mount on element, pass city points
   </script>
   ```

2. **`public/orbital/world-events/index.html`** — standalone event visualization
   globe. Currently 400 lines of inline Three.js. Will become:
   ```javascript
   import { createGlobe } from '/orbital/viz/dist/globe.js';
   const globe = await createGlobe(container, { cesiumToken });
   globe.addPoints('events', events);
   ```

Migration is blocked only on having the Cesium Ion token. Without it, the
fallback mode of `createGlobe` is already equivalent to the current implementation.

---

## Cesium Ion setup

1. Register at https://cesium.com/ (free tier sufficient)
2. Create a token in the dashboard (default token works)
3. Add to server `.env`:
   ```
   CESIUM_KEY=your-token-here
   ```
4. The server exposes it via a new route `/api/cesium-key` (to be added)
5. Globe pages fetch the token at init time and pass it to `createGlobe`

Asset ID `2275207` is Bing Maps Aerial with Labels — the tile set used
in the original terratwin implementation. Other Cesium Ion assets are available
(OpenStreetMap, Google Photorealistic 3D Tiles, etc.) and can be swapped by
changing `assetId` in the globe options.
