/**
 * @orbital/viz — framework-agnostic visualization utilities.
 *
 * Globe, charts, and geographic layer tools for geospatial applications.
 * Works in vanilla HTML pages, Svelte, React, or any ES module context.
 *
 * @example
 *   import { createGlobe } from '@orbital/viz/globe';
 *   import { timeSeries }  from '@orbital/viz/chart';
 */

export { createGlobe }            from './globe/index.js';
export { timeSeries, barChart, statCard } from './chart/index.js';
