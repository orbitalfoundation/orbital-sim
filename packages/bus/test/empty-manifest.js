// An intentionally boring manifest: declares one agent that just logs ticks.
// Used by CLI smoke test.

export const meta = {
  name: 'empty-system',
  description: 'Smallest possible manifest — one tick-logging agent.',
};

export const logger = {
  id: 'logger',
  resolve(event) {
    if (event.tick) console.log(`tick ${event.tick}  t=${event.t}  dt=${event.dt}`);
    if (event.load === 'manifest') console.log(`manifest loaded: ${event.count} agent(s)`);
  },
};
