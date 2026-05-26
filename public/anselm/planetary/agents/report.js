// report — diagnostic agent. Prints a table of every cell + every field
// after each tick. Drop from the manifest if you don't want the noise.

export default {
  id: 'report',
  fields: ['elevation_m', 'tsi_w_m2'],

  resolve(event, sim) {
    if (!event.tick && !event.done) return;
    const world = sim.world;
    if (!world) return;

    const header = ['lat', 'lon', ...this.fields];
    console.log(`\n[t=${world.time().toISOString()}]  tick ${event.tick ?? '-'}`);
    console.log(header.map((h) => h.padStart(10)).join(''));
    for (const cell of world.cells()) {
      const cols = [
        String(cell.lat),
        String(cell.lon),
        ...this.fields.map((f) => {
          const v = world.getField(cell.token, f);
          return v == null ? '-' : v.toFixed(0);
        }),
      ];
      console.log(cols.map((c) => c.padStart(10)).join(''));
    }
  },
};
