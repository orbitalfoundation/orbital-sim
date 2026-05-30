// elevation — surface heightfield, written once on load.
//
// Reads bus.world (set up by the world agent). Writes elevation_m for every cell.
// Override sample(cell) in the manifest entry to supply real heights; the default
// is a cheap latitudinal bump for sanity tests.

const baseAgent = {
  id: 'elevation',

  sample(cell) {
    return Math.max(0, 1000 * Math.cos(cell.lat * Math.PI / 180));
  },

  resolve(event, bus) {
    if (!event.registered && !event.tick) return;
    const world = bus.world;
    if (!world || this._initialized) return;
    this._initialized = true;
    for (const cell of world.cells()) {
      const h = bus.elevation?.sample(cell.lon, cell.lat) ?? this.sample(cell);
      world.setField(cell.token, 'elevation_m', h);
    }
  },
};

baseAgent.resolve.after = 'world';

export default baseAgent;
