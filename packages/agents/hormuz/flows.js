// flows — commodity flow network for the Hormuz scenario.
//
// This is the foundational agent. It models how much of each commodity
// can actually move from producers to consumers given current route availability.
//
// The sole input that drives the cascade is the blockade parameter (0–1).
// Everything else — energy prices, fertilizer shortages, food insecurity —
// emerges from flow reductions computed here.
//
// Routes:
//   Hormuz strait (blockade_sensitivity = 1.0) — primary chokepoint
//   Saudi East-West Pipeline                    — Saudi crude only, ~2 Mbpd
//   Abu Dhabi-Fujairah Pipeline                 — UAE crude only, ~1.5 Mbpd
//   Iraq-Turkey Pipeline                        — Kirkuk crude only, ~0.2 Mbpd
//   Cape of Good Hope                           — full bypass, +18 days, +$4.5/bbl
//   Suez Canal                                  — partial bypass, Europe-bound only
//
// bus.flows installs:
//   .rate(commodity)        — global flow rate, fraction of baseline (0-1)
//   .price_pressure(commodity) — supply-side pressure on price (0 = no pressure, 1 = severe)
//   .stranded_volume(commodity) — cumulative undelivered volume since closure

// Baseline commodity flows through Hormuz (pre-crisis reference values)
// (Data files are in public/orbital/hormuz/data/ — loaded on demand for visualization)
const BASELINE = {
  crude_oil:  17.0,   // Mbpd through strait
  lng:        77.0,   // MMtpa
  urea:       25.0,   // Mtpa (rough — Gulf is ~30% of seaborne trade)
  ammonia:    12.0,   // Mtpa
  sulfur:     14.0,   // Mtpa (Gulf ~50% of seaborne)
  helium:     36.0,   // MMcm/year — Qatar's share
  methanol:   12.0,   // Mtpa
};

// What fraction of each commodity CAN bypass Hormuz (pipelines + Cape rerouting)
// Cape rerouting is costly/slow — modelled as partial because not all tankers can
// absorb the cost/time penalty.
const BYPASS_CAPACITY = {
  crude_oil:  0.28,  // East-West (2.0/17) + Fujairah (1.5/17) + Cape partial
  lng:        0.03,  // Almost none — no LNG pipeline bypasses; Cape theoretically possible but slow
  urea:       0.10,  // Some from non-Gulf producers, some Cape routing
  ammonia:    0.08,
  sulfur:     0.05,
  helium:     0.04,  // US production can partially substitute but not replace Qatar volumes quickly
  methanol:   0.12,
};

// Speed at which bypass capacity ramps up (0 on day 1 → full bypass after RAMP days)
// Pipelines switch on within days; Cape routing requires fleet repositioning (weeks)
const BYPASS_RAMP_DAYS = {
  crude_oil: 30,
  lng: 90,
  urea: 60,
  ammonia: 60,
  sulfur: 60,
  helium: 120,  // US surge capacity is slow to develop; Qatar helium has no fast substitute
  methanol: 45,
};

const flowsAgent = {
  id: 'flows',
  blockade: 0,        // 0 = strait fully open, 1 = fully closed. Set by manifest or scenario event.
  day: 0,             // simulation day (for ramp-up calculation)

  resolve(event, bus) {
    if (event.registered) {
      this._stranded = Object.fromEntries(Object.keys(BASELINE).map(k => [k, 0]));
      this._rampFactor = Object.fromEntries(Object.keys(BASELINE).map(k => [k, 0]));

      bus.install('flows', {
        // Actual flow rate as fraction of baseline (0-1)
        rate: (commodity) => this._rate(commodity),
        // Supply pressure: 0 = no pressure, 1 = severe (fully blocked, no bypass)
        price_pressure: (commodity) => 1 - this._rate(commodity),
        // Cumulative undelivered volume since blockade began (in baseline units)
        stranded_volume: (commodity) => this._stranded[commodity] ?? 0,
        // Baseline reference
        baseline: (commodity) => BASELINE[commodity] ?? 0,
      });
      return;
    }

    if (event.tick) {
      this.day = Math.round(event.dt / 86400) || 1; // approximate days per tick
      this._updateRamps(event.dt);
      this._updateStranded(event.dt);

      // Console summary
      const oil_rate = this._rate('crude_oil');
      const lng_rate = this._rate('lng');
      const he_rate  = this._rate('helium');
      console.log(
        `[flows] blockade=${(this.blockade * 100).toFixed(0)}%` +
        `  oil=${(oil_rate * 100).toFixed(0)}%` +
        `  LNG=${(lng_rate * 100).toFixed(0)}%` +
        `  helium=${(he_rate * 100).toFixed(0)}%`,
      );
    }
  },

  _rate(commodity) {
    if (!BASELINE[commodity]) return 1;
    const bypass = (BYPASS_CAPACITY[commodity] ?? 0) * (this._rampFactor[commodity] ?? 0);
    const hormuz_fraction = 1 - bypass;
    // Hormuz carries (1-bypass) of the flow; blockade reduces that
    const through_hormuz = hormuz_fraction * (1 - this.blockade);
    return Math.min(1, bypass + through_hormuz);
  },

  _updateRamps(dtSeconds) {
    const dtDays = dtSeconds / 86400;
    for (const commodity of Object.keys(BYPASS_CAPACITY)) {
      const rampDays = BYPASS_RAMP_DAYS[commodity] ?? 60;
      if (this.blockade > 0) {
        // Ramp up as operators find alternatives
        this._rampFactor[commodity] = Math.min(1,
          (this._rampFactor[commodity] ?? 0) + dtDays / rampDays
        );
      } else {
        // Ramp back down when blockade lifts (some displacement is sticky)
        this._rampFactor[commodity] = Math.max(0,
          (this._rampFactor[commodity] ?? 0) - dtDays / (rampDays * 0.5)
        );
      }
    }
  },

  _updateStranded(dtSeconds) {
    const dtDays = dtSeconds / 86400;
    for (const [commodity, baseline] of Object.entries(BASELINE)) {
      const blocked = baseline * this.blockade * (1 - (BYPASS_CAPACITY[commodity] ?? 0));
      this._stranded[commodity] = (this._stranded[commodity] ?? 0) + blocked * dtDays;
    }
  },
};

export default flowsAgent;
