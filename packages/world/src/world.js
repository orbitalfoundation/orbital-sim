// world — installs bus.world: a cell grid with a per-cell field store and a clock.
//
// Use via manifest:
//   export const world = { inherits: '@orbital/world', lats: [...], lons: [...], t0: '...' }
//
// After the load event, bus.world provides:
//   cells()                       — Array<{ token, lat, lon }>
//   time()                        — current Date
//   advance(dtSeconds)            — advance the clock
//   setField(token, name, value)  — write a named field on a cell
//   getField(token, name)         — read it back
//   field(name)                   — Map<token, value> for a field
//   snapshot(name)                — plain object of all values for a field

export default {
  id: 'world',
  lats: [-60, -30, 0, 30, 60],
  lons: [-120, 0, 120],
  t0: '2026-06-21T12:00:00Z',

  resolve(event, bus) {
    if (!event.registered) return;

    const cells = [];
    for (const lat of this.lats) {
      for (const lon of this.lons) {
        cells.push({ token: `cell:${lat}:${lon}`, lat, lon });
      }
    }

    const fields = new Map();
    let t = new Date(this.t0);

    const ensure = (name) => {
      if (!fields.has(name)) fields.set(name, new Map());
      return fields.get(name);
    };

    bus.install('world', {
      cells: () => cells,
      time: () => t,
      advance(dtSeconds) { t = new Date(t.getTime() + dtSeconds * 1000); },
      setField(token, name, value) { ensure(name).set(token, value); },
      getField(token, name) { return fields.get(name)?.get(token); },
      field(name) { return ensure(name); },
      snapshot(name) {
        const f = fields.get(name);
        return f ? Object.fromEntries(f) : {};
      },
    });
  },
};
