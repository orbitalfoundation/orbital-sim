// elevation — surface heightfield, written once on `load`.
//
// Reads sim.world (set up by the `world` agent). Writes the `elevation_m`
// field for every cell.
//
// Override `sample(cell)` in the manifest to supply real heights; the default
// is a cheap latitudinal bump for sanity tests.

const baseAgent = {
  id: 'elevation',
  label: 'Surface elevation heightfield',

  sample(cell) {
    return Math.max(0, 1000 * Math.cos(cell.lat * Math.PI / 180));
  },

  resolve(event, sim) {
    if (!event.load) return;
    const world = sim.world;
    if (!world) return;
    for (const cell of world.cells()) {
      world.setField(cell.token, 'elevation_m', this.sample(cell));
    }
  },
};

// run after world has built sim.world
baseAgent.resolve.after = 'world';

export default baseAgent;
