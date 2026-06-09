// observe — emits structured simulation state on each tick.
//
// Fires { observe: { ...state } } into the bus so the server tap can forward
// it to the web client without the server needing to know Hormuz domain details.
// All domain knowledge stays in this agent, the tap stays generic.

const observeAgent = {
  id: 'hormuz.observe',

  resolve(event, bus) {
    if (!event.tick) return;

    const countries = bus.food?.all_countries?.() ?? [];

    bus.resolve({ observe: {
      tick:               event.tick,
      week:               event.tick,

      // Flows
      blockade:           bus.flows?.blockade          ?? 0,
      oil_flow:           bus.flows?.rate?.('crude_oil') ?? 1,
      lng_flow:           bus.flows?.rate?.('lng')       ?? 1,
      helium_flow:        bus.flows?.rate?.('helium')    ?? 1,

      // Energy prices
      brent:              bus.energy?.price?.('crude_brent') ?? 80,
      lng_price:          bus.energy?.price?.('lng_jkm')     ?? 12,
      spr_drawn:          1 - (bus.energy?.reserve_days?.() ?? 90) / 90,

      // Fertilizer cascade
      plant_util:         bus.fertilizer?.plant_utilization?.()  ?? 1,
      urea_price_index:   bus.fertilizer?.price_index?.('urea')  ?? 1,

      // Agriculture
      wheat_yield:        bus.agriculture?.yield_index?.('wheat')  ?? 1,
      food_production:    bus.agriculture?.food_production_index?.() ?? 1,
      n_application:      bus.agriculture?.application_rate?.('nitrogen') ?? 1,

      // Food security
      people_at_risk:     bus.food?.people_at_risk?.() ?? 0,

      // Helium
      helium_avail:       bus.helium?.availability?.()      ?? 1,
      helium_days_offline:bus.helium?.days_offline?.()      ?? 0,
      helium_destroyed:   bus.helium?.supply_destroyed_mmcm?.() ?? 0,
      semiconductor_impact: bus.helium?.semiconductor_impact?.() ?? 0,

      // Country-level stress for map coloring
      // Each entry: { id, name, lat, lon, type, stress, insecurity_level, food_price_index }
      countries: countries.map(c => ({
        id:              c.id,
        stress:          c.stress ?? 0,
        insecurity:      c.insecurity ?? 0,
        price_index:     c.price_index ?? 1,
      })),
    }}).catch(() => {}); // fire-and-forget
  },
};

observeAgent.resolve.after = 'food-security';
export default observeAgent;
