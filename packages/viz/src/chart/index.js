/**
 * chart — lightweight chart utilities built on Observable Plot.
 *
 * Observable Plot is loaded from CDN on first use (no bundle-time dependency).
 * All charts render to SVG and accept plain JavaScript arrays.
 *
 * https://observablehq.com/plot/
 *
 * @example
 *   import { timeSeries } from '@orbital/viz/chart';
 *   const svg = await timeSeries(container, data, { x: 'date', y: 'value' });
 */

const PLOT_CDN = 'https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm';

let _Plot = null;
async function getPlot() {
  if (!_Plot) _Plot = await import(PLOT_CDN);
  return _Plot;
}

// Orbital dark-theme defaults
const THEME = {
  background: 'transparent',
  color:       '#9090b0',    // --muted
  accent:      '#0fd4bc',    // --accent
  grid:        '#1e1e30',    // --border
  text:        '#dcdce8',    // --text
};

/**
 * timeSeries — line chart with time on X axis.
 * @param {HTMLElement} container
 * @param {Array}       data
 * @param {{ x: string, y: string|string[], title?: string }} opts
 */
export async function timeSeries(container, data, opts = {}) {
  const Plot = await getPlot();
  const { x = 'date', y = 'value', title } = opts;
  const ys = Array.isArray(y) ? y : [y];

  const marks = ys.flatMap((field, i) => [
    Plot.line(data, {
      x, y: field,
      stroke: i === 0 ? THEME.accent : `hsl(${(i * 60 + 200) % 360}, 70%, 60%)`,
      strokeWidth: 1.5,
    }),
    Plot.dot(data, {
      x, y: field,
      fill: i === 0 ? THEME.accent : `hsl(${(i * 60 + 200) % 360}, 70%, 60%)`,
      r: 2,
    }),
  ]);

  const chart = Plot.plot({
    width:  container.clientWidth  || 600,
    height: container.clientHeight || 240,
    style: { background: THEME.background, color: THEME.text, fontSize: '11px' },
    x:     { type: 'time', label: null, grid: true, gridColor: THEME.grid },
    y:     { label: null,  grid: true, gridColor: THEME.grid },
    marks: [
      Plot.gridX({ stroke: THEME.grid }),
      Plot.gridY({ stroke: THEME.grid }),
      ...marks,
      ...(title ? [Plot.text([title], { frameAnchor: 'top-left', dx: 8, dy: 8, fill: THEME.text })] : []),
    ],
  });

  container.replaceChildren(chart);
  return chart;
}

/**
 * barChart — horizontal or vertical bar chart.
 */
export async function barChart(container, data, opts = {}) {
  const Plot = await getPlot();
  const { x = 'label', y = 'value', horizontal = true, title } = opts;

  const chart = Plot.plot({
    width:  container.clientWidth  || 600,
    height: container.clientHeight || 300,
    style: { background: THEME.background, color: THEME.text, fontSize: '11px' },
    marginLeft: horizontal ? 120 : 40,
    marks: [
      horizontal
        ? Plot.barX(data, { x: y, y: x, fill: THEME.accent, sort: { y: '-x' } })
        : Plot.barY(data, { x,  y,     fill: THEME.accent }),
      Plot.ruleX([0], { stroke: THEME.grid }),
    ],
  });

  container.replaceChildren(chart);
  return chart;
}

/**
 * statCard — single large number with label and optional delta.
 */
export function statCard(container, { value, label, delta, unit = '' }) {
  const sign  = delta >= 0 ? '+' : '';
  const color = delta > 0 ? '#ef4444' : delta < 0 ? '#22c55e' : THEME.text;

  container.innerHTML = `
    <div style="font-family:ui-monospace,monospace;padding:12px 16px;color:${THEME.text}">
      <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:${THEME.text};opacity:.6;margin-bottom:4px">${label}</div>
      <div style="font-size:28px;font-weight:400;line-height:1.1">${value}${unit}</div>
      ${delta != null ? `<div style="font-size:12px;color:${color};margin-top:4px">${sign}${delta}${unit}</div>` : ''}
    </div>`;
}
