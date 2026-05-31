// report — prints a table of cells and field values on each tick and on done.
// Gets cell list from bus.insolation (or bus.elevation if available).
// Field getters are keyed by field name — add new ones here as agents are added.

const fieldGetters = {
  tsi_w_m2:    (cell, bus) => bus.insolation?.at(cell.idx),
  elevation_m: (cell, bus) => bus.elevation?.sample(cell.lon, cell.lat),
};

const reportAgent = {
  id: 'report',
  fields: ['tsi_w_m2'],

  resolve(event, bus) {
    if (!event.tick && !event.done) return;

    const cells = bus.insolation?.cells() ?? [];
    if (!cells.length) return;

    const t = new Date(event.t * 1000).toISOString();
    const header = ['lat', 'lon', ...this.fields];
    console.log(`\n[t=${t}]  tick ${event.tick ?? '-'}`);
    console.log(header.map(h => h.padStart(10)).join(''));
    for (const cell of cells) {
      const cols = [
        String(cell.lat), String(cell.lon),
        ...this.fields.map(f => {
          const v = fieldGetters[f]?.(cell, bus);
          return v == null ? '-' : v.toFixed(0);
        }),
      ];
      console.log(cols.map(c => c.padStart(10)).join(''));
    }
  },
};

reportAgent.resolve.after = 'insolation';

export default reportAgent;
