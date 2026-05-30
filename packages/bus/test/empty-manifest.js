// An intentionally boring manifest: declares one agent that just logs ticks.
// Used by CLI smoke test.

export const log_activity_agent = {
  id: 'log_activity_agent',
  resolve(event) {
    if (event.tick) console.log(`tick ${event.tick}  t=${event.t}  dt=${event.dt}`);
  },
};
