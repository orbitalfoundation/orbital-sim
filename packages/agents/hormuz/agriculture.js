// agriculture — crop yield impact model.
//
// Reads fertilizer price and availability from bus.fertilizer.
// Computes farmer application rate response, then applies FAO yield elasticities.
//
// Key mechanism: farmers in price-sensitive markets reduce fertilizer application
// when prices spike. Yield follows application via a diminishing-returns function.
// The spring planting window creates a hard deadline — if prices spike in planting
// season, that year's crop is committed to reduced inputs.
//
// FAO yield elasticities (approximate):
//   Cereals (wheat, rice, maize): yield elasticity to nitrogen ~0.35-0.55
//   Meaning: 30% reduction in N application → ~10-17% yield reduction
//
// bus.agriculture installs:
//   .yield_index(crop)          — expected yield relative to baseline (1.0 = normal)
//   .application_rate(input)    — fertilizer application as fraction of optimal
//   .food_production_index()    — global weighted average yield

// Proportion of global supply in regions that will reduce application when price spikes
// (price-insensitive markets like US/EU use less, price-sensitive like S/SE Asia use more)
const PRICE_SENSITIVE_SHARE = {
  wheat: 0.45,   // South Asia, MENA
  rice:  0.55,   // South and Southeast Asia
  maize: 0.40,   // Sub-Saharan Africa, parts of Asia
};

// Elasticity of farmer application to fertilizer price increase
// (at what price multiple do farmers halve their application?)
const APPLICATION_ELASTICITY = 0.6;  // 1% price increase → 0.6% application reduction in sensitive markets

// FAO nitrogen yield elasticity: yield change per fractional N application change
const YIELD_ELASTICITY = {
  wheat: 0.42,
  rice:  0.38,
  maize: 0.48,
};

const agricultureAgent = {
  id: 'agriculture',

  resolve(event, bus) {
    if (event.registered) {
      this._application_rate = { nitrogen: 1.0, phosphate: 1.0 };
      this._yield_index      = { wheat: 1.0, rice: 1.0, maize: 1.0 };

      bus.install('agriculture', {
        yield_index:          (crop) => this._yield_index[crop] ?? 1,
        application_rate:     (input) => this._application_rate[input] ?? 1,
        food_production_index: ()    => {
          // Weighted average: wheat ~30%, rice ~35%, maize ~35% of global calorie supply
          return 0.30 * this._yield_index.wheat
               + 0.35 * this._yield_index.rice
               + 0.35 * this._yield_index.maize;
        },
      });
      return;
    }

    if (event.tick) {
      const urea_px  = bus.fertilizer?.price_index('urea')     ?? 1;
      const phos_px  = bus.fertilizer?.price_index('phosphate') ?? 1;

      // Farmer application response: price-sensitive markets reduce application
      // Application reduction = elasticity × (price_index - 1) × sensitive_share
      const n_reduction    = Math.min(0.8, APPLICATION_ELASTICITY * (urea_px - 1));
      const phos_reduction = Math.min(0.8, APPLICATION_ELASTICITY * (phos_px - 1));

      // Global application rate (blended: sensitive markets reduce, others don't)
      this._application_rate.nitrogen  = 1 - n_reduction    * 0.5;  // ~50% of global is price-sensitive
      this._application_rate.phosphate = 1 - phos_reduction * 0.4;

      // Yield impact via FAO elasticities
      // Note: yield impacts lag application by one growing season (~6 months average)
      // For simplicity modelled as current-tick — a more sophisticated model would lag
      for (const [crop, elasticity] of Object.entries(YIELD_ELASTICITY)) {
        const n_app_fraction  = this._application_rate.nitrogen;
        const ph_app_fraction = this._application_rate.phosphate;
        // Yield = baseline × (N_app)^elasticity × (P_app)^(elasticity*0.5)
        this._yield_index[crop] = Math.pow(n_app_fraction, elasticity)
                                * Math.pow(ph_app_fraction, elasticity * 0.5);
      }

      const fpi = bus.agriculture.food_production_index();
      console.log(
        `[agriculture] N-app=${(this._application_rate.nitrogen * 100).toFixed(0)}%` +
        `  wheat-yield=${(this._yield_index.wheat * 100).toFixed(1)}%` +
        `  food-production=${(fpi * 100).toFixed(1)}%`,
      );
    }
  },
};

agricultureAgent.resolve.after = 'fertilizer';
export default agricultureAgent;
