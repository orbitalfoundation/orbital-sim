// energy — oil and LNG price model.
//
// Reads supply pressure from bus.flows and computes spot prices.
// Models strategic reserve drawdown as a buffer that delays price impact.
//
// Price model: supply shock → price = baseline * (1 + elasticity * pressure)
// The oil price elasticity of supply is approximately -0.1 to -0.3 short-run
// (a 10% supply reduction → 30-100% price increase), reflecting the inelastic
// nature of oil demand in the short run.
//
// bus.energy installs:
//   .price(commodity)       — current spot price (USD/barrel for oil, USD/MMBtu for gas)
//   .price_index(commodity) — price relative to baseline (1.0 = no change)
//   .reserve_days(commodity, country_id) — estimated days of reserve remaining

// Baseline pre-crisis reference prices
const BASELINE_PRICE = {
  crude_brent: 80,    // USD/barrel
  crude_wti:   75,
  lng_jkm:     12,    // USD/MMBtu (Japan-Korea Marker, Asian LNG spot)
  lng_ttf:     10,    // EUR/MWh converted (European TTF hub)
  natural_gas:  3,    // USD/MMBtu (Henry Hub, US benchmark)
};

// Short-run price elasticity: how much prices rise per unit of supply pressure (0-1)
// Higher magnitude = more inelastic demand = sharper price spikes
const PRICE_ELASTICITY = {
  crude_brent:  4.0,   // 10% supply cut → 40% price increase (empirical range 3-8x)
  crude_wti:    4.0,
  lng_jkm:      6.0,   // LNG spot more volatile — fewer substitutes, longer-haul alternatives
  lng_ttf:      5.5,
  natural_gas:  3.0,   // More domestic insulation for US markets
};

// Strategic reserve buffer: how much supply pressure is absorbed before prices spike
// 90-day IEA reserve → absorbs roughly 0.15 of annual supply pressure
const RESERVE_BUFFER = {
  crude_brent: 0.12,   // Global average; weighted by consumer country SPR levels
  lng_jkm:     0.02,   // LNG reserves are minimal — gas is hard to stockpile at scale
};

const energyAgent = {
  id: 'energy',

  resolve(event, bus) {
    if (event.registered) {
      this._price_index = Object.fromEntries(Object.keys(BASELINE_PRICE).map(k => [k, 1.0]));
      this._reserve_drawn = 0; // fraction of strategic reserve consumed

      bus.install('energy', {
        price:       (commodity) => BASELINE_PRICE[commodity] * (this._price_index[commodity] ?? 1),
        price_index: (commodity) => this._price_index[commodity] ?? 1,
        reserve_days: () => Math.max(0, 90 * (1 - this._reserve_drawn)),
      });
      return;
    }

    if (event.tick) {
      const oil_pressure = bus.flows?.price_pressure('crude_oil') ?? 0;
      const lng_pressure = bus.flows?.price_pressure('lng') ?? 0;

      // Reserves absorb some oil pressure
      const effective_oil = Math.max(0, oil_pressure - RESERVE_BUFFER.crude_brent * (1 - this._reserve_drawn));

      // Update price indices
      this._price_index['crude_brent'] = 1 + PRICE_ELASTICITY.crude_brent * effective_oil;
      this._price_index['crude_wti']   = 1 + PRICE_ELASTICITY.crude_wti   * effective_oil * 0.95;
      this._price_index['lng_jkm']     = 1 + PRICE_ELASTICITY.lng_jkm     * lng_pressure;
      this._price_index['lng_ttf']     = 1 + PRICE_ELASTICITY.lng_ttf     * lng_pressure * 0.8;
      this._price_index['natural_gas'] = 1 + PRICE_ELASTICITY.natural_gas  * lng_pressure * 0.4;

      // Reserves drawn down over time at rate proportional to supply deficit
      const dtDays = event.dt / 86400;
      if (oil_pressure > 0) {
        this._reserve_drawn = Math.min(1, this._reserve_drawn + oil_pressure * dtDays / 90);
      } else {
        // Reserves rebuild when supply normalises (slower than drawdown)
        this._reserve_drawn = Math.max(0, this._reserve_drawn - dtDays / 180);
      }

      const brent = bus.energy.price('crude_brent');
      const jkm   = bus.energy.price('lng_jkm');
      console.log(
        `[energy] Brent=$${brent.toFixed(0)}/bbl` +
        `  LNG-JKM=$${jkm.toFixed(1)}/MMBtu` +
        `  SPR=${(this._reserve_drawn * 100).toFixed(0)}% drawn`,
      );
    }
  },
};

energyAgent.resolve.after = 'flows';
export default energyAgent;
