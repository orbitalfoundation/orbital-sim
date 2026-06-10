# @orbital/viz

Framework-agnostic visualization utilities for geospatial and data-rich applications.

Works in vanilla HTML (via importmap or CDN), Svelte, React, or any ES module context. No framework required. Three.js is a peer dependency.

## What's here

| Module | Contents |
|---|---|
| `@orbital/viz/globe` | Interactive 3D globe — Cesium Ion satellite tiles when a token is available, textured Three.js sphere as fallback |
| `@orbital/viz/chart` | Time-series, bar, stat card — built on Observable Plot |

Growing: Deck.gl geographic layers (choropleth, heatmaps, animated flow arcs), Sankey diagrams, network graphs.

## Globe

```javascript
import { createGlobe } from '@orbital/viz/globe';

const globe = await createGlobe(document.getElementById('map'), {
  cesiumToken: 'your-cesium-ion-token',  // optional; falls back to a texture
  mode: 'globe',  // 'globe' | 'orbit'
  lat: 26.6, lon: 57.0,  // initial camera position
});

// Add coloured point cloud
globe.addPoints('events', [
  { lat: 26.6, lon: 57.0, color: 0xef4444, size: 0.02 },
]);

// Animate camera to a location
globe.focusOn(26.6, 57.0);

// Clean up
globe.dispose();
```

### Cesium Ion token

Register at https://cesium.com/ (free tier available). The globe uses Bing Maps satellite imagery (asset ID 2275207). Set in your server `.env`:

```
CESIUM_KEY=your-token-here
```

Without a token the globe falls back to a plain Earth texture and still supports all the overlay APIs (points, arcs).

## Charts

```javascript
import { timeSeries, barChart, statCard } from '@orbital/viz/chart';

// Time-series line chart
await timeSeries(container, data, { x: 'date', y: 'price', title: 'Brent Crude' });

// Horizontal bar chart
await barChart(container, countries, { x: 'name', y: 'stress', horizontal: true });

// Single stat display
statCard(container, { value: '3.2', unit: '°C', label: 'Global ΔT', delta: '+0.1' });
```

Charts use [Observable Plot](https://observablehq.com/plot/) loaded from CDN on first use. Dark theme by default.

## Install

```bash
npm install @orbital/viz
# peer dep — you need three.js
npm install three
```

Or use within the orbital-sim monorepo (already in workspaces).

## Build

```bash
cd packages/viz
npm run build   # outputs to dist/
```

## npm publish

The package name `@orbital/viz` requires an `@orbital` npm organization. Rename to `@orbitalfoundation/viz` (or similar) before publishing.

```bash
npm publish --access public
```
