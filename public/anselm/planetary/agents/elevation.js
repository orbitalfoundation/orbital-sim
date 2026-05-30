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
    if (!event.load) return;
    const world = bus.world;
    if (!world) return;
    for (const cell of world.cells()) {
      world.setField(cell.token, 'elevation_m', this.sample(cell));
    }
  },
};

baseAgent.resolve.after = 'world';

export default baseAgent;
