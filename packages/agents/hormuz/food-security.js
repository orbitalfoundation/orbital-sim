// food-security — population-level food and economic stress model.
//
// The final layer of the cascade. Reads yield indices and flow disruptions
// from upstream agents and computes country-level stress indicators.
//
// Stressors combined per country:
//   1. Direct food import disruption (if food comes through Hormuz)
//   2. Food price inflation (from reduced crop yields globally)
//   3. Fuel cost impact on domestic food production and distribution
//   4. Fertilizer application reduction → future yield reduction
//
// WFP food insecurity thresholds (simplified):
//   <1.2x baseline food cost: stressed but manageable
//   1.2-1.5x: acute food insecurity risk in vulnerable populations
//   1.5-2.0x: crisis-level food insecurity; displacement risk
//   >2.0x: emergency / famine conditions in most vulnerable countries
//
// bus.food installs:
//   .price_index(country_id)     — food price relative to baseline for that country
//   .insecurity_level(country_id) — 0=normal, 1=stressed, 2=acute, 3=crisis, 4=emergency
//   .people_at_risk()            — estimated additional people in food insecurity (millions)
//   .stress(country_id)          — composite 0-1 stress score for visualization

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const _dir = dirname(fileURLToPath(import.meta.url));
const countryData = JSON.parse(
  readFileSync(join(_dir, '../../../public/orbital/hormuz/data/countries.json'), 'utf8')
);

// Food price elasticity to oil price (energy in production and transport)
const FOOD_OIL_ELASTICITY = 0.12;  // 10% oil price increase → 1.2% food price increase

// Food price elasticity to crop yield (supply-side)
const FOOD_YIELD_ELASTICITY = 0.8;  // 10% yield reduction → 8% food price increase globally

// WFP vulnerability multiplier by country SPR days (lower reserves = faster price passthrough)
function vulnerabilityMultiplier(country) {
  const spr = country.spr_days ?? 30;
  return Math.max(0.5, 3.0 - spr / 50);  // 7-day reserve → 2.86x; 90-day → 1.2x
}

const foodSecurityAgent = {
  id: 'food-security',

  resolve(event, bus) {
    if (event.registered) {
      this._countries = countryData.countries;
      this._state = {};
      for (const c of this._countries) {
        this._state[c.id] = { price_index: 1.0, insecurity: 0, stress: 0 };
      }

      bus.install('food', {
        price_index:    (id) => this._state[id]?.price_index ?? 1,
        insecurity_level: (id) => this._state[id]?.insecurity ?? 0,
        stress:         (id) => this._state[id]?.stress ?? 0,
        people_at_risk: ()   => this._peopleAtRisk(),
        all_countries:  ()   => this._countries.map(c => ({
          ...c,
          ...this._state[c.id],
        })),
      });
      return;
    }

    if (event.tick) {
      const oil_index  = bus.energy?.price_index('crude_brent') ?? 1;
      const fpi        = bus.agriculture?.food_production_index() ?? 1;

      // Global food price shift from oil costs and yield change
      const yield_shock = (1 - fpi);  // fraction yield lost
      const global_food_price_shift =
          FOOD_OIL_ELASTICITY   * (oil_index - 1)
        + FOOD_YIELD_ELASTICITY * yield_shock;

      let total_at_risk = 0;

      for (const country of this._countries) {
        if (country.type === 'exporter') continue;

        const vuln = vulnerabilityMultiplier(country);
        const food_import = country.food_import_pct ?? 0.1;
        const gulf_oil    = country.gulf_oil_fraction ?? 0;

        // Country-specific food price:
        // Global food price shift × vulnerability × import exposure
        const local_shift = global_food_price_shift * vuln
                          + gulf_oil * (oil_index - 1) * 0.05;  // direct fuel cost in food
        const price_index = Math.max(1, 1 + local_shift);

        // Insecurity level (0-4 scale)
        let insecurity = 0;
        if (price_index > 1.2) insecurity = 1;
        if (price_index > 1.5) insecurity = 2;
        if (price_index > 1.8) insecurity = 3;
        if (price_index > 2.2) insecurity = 4;

        // Stress score for visualization (0-1)
        const stress = Math.min(1, (price_index - 1) / 1.5);

        // Rough people-at-risk estimate: insecurity level 2+ → % of pop at risk
        const pop = country.population_millions ?? 0;
        if (insecurity >= 2) {
          const at_risk_fraction = [0, 0, 0.05, 0.15, 0.35][insecurity];
          total_at_risk += pop * at_risk_fraction;
        }

        this._state[country.id] = { price_index, insecurity, stress };
      }

      const top = this._countries
        .filter(c => this._state[c.id]?.insecurity >= 2)
        .sort((a, b) => (this._state[b.id]?.stress ?? 0) - (this._state[a.id]?.stress ?? 0))
        .slice(0, 3)
        .map(c => `${c.name}(${this._state[c.id].insecurity})`);

      console.log(
        `[food] at-risk: ${total_at_risk.toFixed(0)}M people` +
        `  most stressed: ${top.join(', ')}`,
      );
    }
  },

  _peopleAtRisk() {
    let total = 0;
    for (const country of this._countries) {
      const { insecurity, price_index } = this._state[country.id] ?? {};
      if ((insecurity ?? 0) >= 2) {
        const pop = country.population_millions ?? 0;
        const at_risk_fraction = [0, 0, 0.05, 0.15, 0.35][insecurity ?? 0];
        total += pop * at_risk_fraction;
      }
    }
    return total;
  },
};

foodSecurityAgent.resolve.after = 'agriculture';
export default foodSecurityAgent;
