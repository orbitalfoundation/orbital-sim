// tick — built-in tick driver, registered automatically by createBus.
//
// Fire { run: true, ticks, dt } to step the simulation.
// Fire { run: 'realtime', hz, dt } to start a wall-clock interval (returns a stop fn via result).

export const tickDriver = {
  id: 'bus.tick-driver',
  resolve: async function (event, bus) {
    if (!event.run) return;

    if (event.run === 'realtime') {
      const { hz = 30, dt = 1 / 30 } = event;
      let i = 0;
      const id = setInterval(() => {
        bus.time += dt;
        bus.resolve({ tick: ++i, t: bus.time, dt }).catch((err) => {
          console.error('[bus] ticker error', err);
        });
      }, 1000 / hz);
      return { stop: () => clearInterval(id) };
    }

    const { ticks = 1, dt = 1 } = event;
    for (let i = 0; i < ticks; i++) {
      bus.time += dt;
      await bus.resolve({ tick: i + 1, t: bus.time, dt });
    }
  },
};
