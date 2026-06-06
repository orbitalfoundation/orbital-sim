// fertilizer — nitrogen and phosphate fertilizer production and market.
//
// The cascade mechanism:
//   LNG price rises → natural gas cost exceeds ammonia plant economics → plants shut
//   Sulfur flows blocked → sulfuric acid shortage → phosphate production cut
//   Urea and ammonia price spike → demand rationing in price-sensitive markets
//
// Plant economics: ammonia synthesis (Haber-Bosch) requires ~900°C with natural
// gas as both fuel and feedstock. Gas cost ~70% of production cost. At LNG-JKM
// >$25/MMBtu, most Gulf-gas-dependent plants become uneconomic and shut down.
//
// bus.fertilizer installs:
//   .price_index(type)      — price relative to baseline (1.0 = no change)
//   .availability(type)     — available supply as fraction of baseline
//   .plant_utilization()    — fraction of global capacity operating

// LNG price threshold at which plants start shutting down (USD/MMBtu)
const PLANT_SHUTDOWN_THRESHOLD = 22;   // plants become marginal
const PLANT_OFFLINE_THRESHOLD  = 35;   // plants shut entirely

// Gulf share of global seaborne fertilizer supply (these are the at-risk volumes)
const GULF_SUPPLY_SHARE = {
  urea:     0.41,   // Qatar + Saudi Arabia + UAE + Oman
  ammonia:  0.28,
  sulfur:   0.50,   // Gulf is single largest sulfur exporter
  phosphate: 0.08,  // Less Gulf-centric — Morocco (OCP) and China dominate
};

// Price elasticity: how much price rises per unit of supply loss
const PRICE_ELASTICITY = {
  urea:     2.5,    // Relatively inelastic demand (farmers need it)
  ammonia:  2.0,
  sulfur:   1.5,
  phosphate: 1.8,
};

const fertilizerAgent = {
  id: 'fertilizer',

  resolve(event, bus) {
    if (event.registered) {
      this._price_index = { urea: 1, ammonia: 1, sulfur: 1, phosphate: 1 };
      this._plant_util  = 1.0;

      bus.install('fertilizer', {
        price_index:       (type) => this._price_index[type] ?? 1,
        price:             (type, baseline) => (baseline ?? 300) * (this._price_index[type] ?? 1),
        availability:      (type) => this._availability(type),
        plant_utilization: ()     => this._plant_util,
      });
      return;
    }

    if (event.tick) {
      const lng_price  = bus.energy?.price('lng_jkm') ?? 12;
      const sulfur_pressure = bus.flows?.price_pressure('sulfur') ?? 0;

      // Ammonia/urea plant utilization: drops as LNG price rises above threshold
      if (lng_price < PLANT_SHUTDOWN_THRESHOLD) {
        this._plant_util = 1.0;
      } else if (lng_price > PLANT_OFFLINE_THRESHOLD) {
        this._plant_util = 0.1;  // ~10% remain (most efficient plants / domestic gas)
      } else {
        const t = (lng_price - PLANT_SHUTDOWN_THRESHOLD) / (PLANT_OFFLINE_THRESHOLD - PLANT_SHUTDOWN_THRESHOLD);
        this._plant_util = 1 - t * 0.9;  // linear ramp from 100% to 10%
      }

      // Supply deficit for each fertilizer type
      const urea_loss     = GULF_SUPPLY_SHARE.urea     * (1 - this._plant_util);
      const ammonia_loss  = GULF_SUPPLY_SHARE.ammonia   * (1 - this._plant_util);
      const sulfur_loss   = GULF_SUPPLY_SHARE.sulfur    * sulfur_pressure;
      // Phosphate loss driven by sulfur (sulfuric acid for wet process)
      const phosphate_loss = sulfur_loss * 0.6;

      this._price_index.urea      = 1 + PRICE_ELASTICITY.urea      * urea_loss;
      this._price_index.ammonia   = 1 + PRICE_ELASTICITY.ammonia    * ammonia_loss;
      this._price_index.sulfur    = 1 + PRICE_ELASTICITY.sulfur     * sulfur_loss;
      this._price_index.phosphate = 1 + PRICE_ELASTICITY.phosphate  * phosphate_loss;

      const urea_px = this._price_index.urea;
      console.log(
        `[fertilizer] plants=${(this._plant_util * 100).toFixed(0)}%` +
        `  urea_price=${urea_px.toFixed(2)}x` +
        `  (LNG=$${lng_price.toFixed(1)})`,
      );
    }
  },

  _availability(type) {
    const idx = this._price_index[type] ?? 1;
    // Availability = inverse of price index (simplified — more sophisticated would model inventory)
    return Math.max(0.1, 1 / idx);
  },
};

fertilizerAgent.resolve.after = 'energy';
export default fertilizerAgent;
