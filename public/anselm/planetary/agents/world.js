// world — sets up the shared state namespace on sim.
//
// On the `load` event it builds `sim.world` with:
//   - cells:        () => Array<{ token, lat, lon }>
//   - time:         () => Date
//   - advance(dt):  push the clock forward by dt seconds
//   - setField, getField, field, snapshot
//
// Configure via manifest overrides:
//   - lats, lons: arrays for a synthetic demo grid (default 5x3)
//   - t0: ISO date string or Date for sim start time
//
// Other agents read `sim.world` in their own `load`/`tick` handlers.

export default {
  id: 'world',
  lats: [-60, -30, 0, 30, 60],
  lons: [-120, 0, 120],
  t0: '2026-06-21T12:00:00Z',

  resolve(event, sim) {
    if (!event.load) return;

    const cells = [];
    for (const lat of this.lats) {
      for (const lon of this.lons) {
        cells.push({ token: `demo:${lat}:${lon}`, lat, lon });
      }
    }
    const fields = new Map();
    let t = new Date(this.t0);

    const ensure = (name) => {
      if (!fields.has(name)) fields.set(name, new Map());
      return fields.get(name);
    };

    sim.world = {
      cells: () => cells,
      time:  () => t,
      advance(dtSeconds) { t = new Date(t.getTime() + dtSeconds * 1000); },
      setField(token, name, value) { ensure(name).set(token, value); },
      getField(token, name)        { return fields.get(name)?.get(token); },
      field(name)                  { return ensure(name); },
      snapshot(name) {
        const f = fields.get(name);
        return f ? Object.fromEntries(f) : {};
      },
    };
  },
};
