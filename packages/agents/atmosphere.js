// atmosphere — energy balance model with IPCC AR6 SSP CO₂ trajectories.
//
// Models global mean surface temperature change using a single-layer EBM:
//   C · dΔT/dt = F(CO₂) − λ · ΔT
//
// where F = 5.35·ln(CO₂/280) W/m² (Myhre 1998), λ = 1.24 W/m²/K (ECS = 3°C, AR6
// central estimate), C = 3×10⁸ J/m²/K (effective ocean mixed-layer heat capacity).
//
// Geographic distribution uses AR6 pattern scaling: the EBM global-mean anomaly is
// multiplied by a per-cell amplification factor derived from IPCC AR6 WG1 Chapter 11
// (land > ocean, Arctic amplification ≈ 3×, tropical ocean ≈ 0.65×).
//
// On registration the model spins up silently from 1850 to this.t0 so the starting
// state is consistent with the historical record (~1.1°C by 2024).
//
// bus.atmosphere.co2_ppm()                 — current CO₂ concentration (ppm)
// bus.atmosphere.global_delta_t()          — global-mean temperature anomaly (°C)
// bus.atmosphere.temperature_anomaly(lon,lat) — local anomaly using AR6 pattern (°C)
// bus.atmosphere.year()                    — current simulation year

// ---------- AR6 SSP CO₂ trajectories (ppm) ----------
// Source: Meinshausen et al. 2020 / RCMIP; AR6 WG1 Table 7.SM.6
const SSP = {
  'SSP1-2.6': {
    1850: 285, 1900: 297, 1950: 311, 1980: 339, 2000: 369, 2010: 389, 2020: 412,
    2025: 420, 2030: 426, 2035: 429, 2040: 430, 2045: 428, 2050: 424,
    2060: 411, 2070: 396, 2080: 383, 2090: 374, 2100: 368,
  },
  'SSP2-4.5': {
    1850: 285, 1900: 297, 1950: 311, 1980: 339, 2000: 369, 2010: 389, 2020: 412,
    2025: 422, 2030: 434, 2035: 447, 2040: 461, 2045: 475, 2050: 490,
    2060: 517, 2070: 543, 2080: 567, 2090: 585, 2100: 603,
  },
  'SSP3-7.0': {
    1850: 285, 1900: 297, 1950: 311, 1980: 339, 2000: 369, 2010: 389, 2020: 412,
    2025: 424, 2030: 437, 2035: 452, 2040: 470, 2045: 493, 2050: 519,
    2060: 575, 2070: 646, 2080: 724, 2090: 800, 2100: 867,
  },
  'SSP5-8.5': {
    1850: 285, 1900: 297, 1950: 311, 1980: 339, 2000: 369, 2010: 389, 2020: 412,
    2025: 428, 2030: 447, 2035: 471, 2040: 502, 2045: 538, 2050: 580,
    2060: 678, 2070: 806, 2080: 941, 2090: 1055, 2100: 1135,
  },
};

// Historical CO₂ used only during spin-up (1850 → t0)
const HISTORICAL = {
  1850: 285, 1860: 287, 1870: 289, 1880: 291, 1890: 294,
  1900: 297, 1910: 300, 1920: 303, 1930: 307, 1940: 311,
  1950: 311, 1960: 317, 1970: 325, 1980: 339, 1990: 354,
  2000: 369, 2005: 379, 2010: 389, 2015: 400, 2020: 412,
  2024: 422,
};

function interpolate(table, year) {
  const years = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (year <= years[0]) return table[years[0]];
  if (year >= years[years.length - 1]) return table[years[years.length - 1]];
  for (let i = 0; i < years.length - 1; i++) {
    if (year >= years[i] && year <= years[i + 1]) {
      const f = (year - years[i]) / (years[i + 1] - years[i]);
      return table[years[i]] + f * (table[years[i + 1]] - table[years[i]]);
    }
  }
}

// ---------- AR6 geographic warming pattern ----------
// Amplification factors derived from IPCC AR6 WG1 Chapter 11 / Atlas.
// Returns the ratio of local warming to global-mean warming.
function warmingPattern(lat, lon, isLand) {
  const a = Math.abs(lat);

  // Polar amplification (land or ocean — ice-albedo feedback dominates)
  if (a >= 65) return lat > 0 ? 3.2 : 1.7; // Arctic stronger than Antarctic

  // High latitude (50–65°)
  if (a >= 50) return isLand ? 2.0 : 1.3;

  // Mid latitude (30–50°)
  if (a >= 30) {
    let f = isLand ? 1.5 : 0.9;
    // Mediterranean / MENA: strong drying amplifies warming (AR6 Ch.11 Fig.11.9)
    if (isLand && lat > 28 && lat < 44 && lon > -10 && lon < 50) f *= 1.2;
    return f;
  }

  // Tropics and subtropics (0–30°)
  return isLand ? 1.1 : 0.65;
}

// ---------- EBM constants ----------
const LAMBDA = 1.24; // W/m²/K  (ECS = 3.71/1.24 ≈ 3°C)
const C      = 3e8;  // J/m²/K

function ebmStep(deltaT, co2, dtSeconds) {
  const forcing = 5.35 * Math.log(co2 / 280);
  return deltaT + (dtSeconds / C) * (forcing - LAMBDA * deltaT);
}

// ---------- agent ----------
const atmosphereAgent = {
  id: 'atmosphere',
  scenario: 'SSP2-4.5',
  t0: 2024,  // simulation start year; spin-up runs 1850→t0

  resolve(event, bus) {
    if (event.registered) {
      // Seed bus.time so event.t yields the correct year regardless of how the
      // bus was started (CLI --t0 flag or web startSim with no tStart).
      const startYear = this.t0 ?? 2024;
      bus.time = new Date(`${startYear}-01-01T00:00:00Z`).getTime() / 1000;

      // Spin up silently from 1850 to t0
      let deltaT = 0;
      const dtSec = 365.25 * 86400; // 1-year steps
      for (let y = 1850; y < startYear; y++) {
        deltaT = ebmStep(deltaT, interpolate(HISTORICAL, y), dtSec);
      }

      this._deltaT  = deltaT;
      this._co2     = interpolate(HISTORICAL, startYear);
      this._year    = startYear;
      this._pattern = null; // built lazily on first tick (needs bus.elevation)

      const self = this;
      bus.install('atmosphere', {
        co2_ppm:              () => self._co2,
        global_delta_t:       () => self._deltaT,
        temperature_anomaly:  (lon, lat) => {
          if (!self._pattern) return self._deltaT;
          return self._deltaT * self._samplePattern(lon, lat);
        },
        year: () => self._year,
      });
      return;
    }

    if (event.tick) {
      if (!this._pattern) this._buildPattern(bus);

      const year = new Date(event.t * 1000).getUTCFullYear();
      this._year = year;
      this._co2  = interpolate(SSP[this.scenario] ?? SSP['SSP2-4.5'], year);
      this._deltaT = ebmStep(this._deltaT, this._co2, event.dt);

      const sign = this._deltaT >= 0 ? '+' : '';
      console.log(
        `[${year}]  scenario: ${this.scenario}` +
        `  CO₂: ${this._co2.toFixed(0)} ppm` +
        `  ΔT: ${sign}${this._deltaT.toFixed(2)}°C`,
      );
    }
  },

  // Build a 360×180 (1°) amplification grid, sampling elevation for land/sea.
  _buildPattern(bus) {
    const W = 360, H = 180;
    const grid = new Float32Array(W * H);
    for (let yi = 0; yi < H; yi++) {
      const lat = 89.5 - yi;
      for (let xi = 0; xi < W; xi++) {
        const lon = xi - 179.5;
        const elev   = bus.elevation?.sample(lon, lat) ?? -1;
        grid[yi * W + xi] = warmingPattern(lat, lon, elev >= 0);
      }
    }
    this._pattern  = grid;
    this._patternW = W;
    this._patternH = H;
  },

  _samplePattern(lon, lat) {
    const xi = Math.round(lon + 179.5);
    const yi = Math.round(89.5 - lat);
    const x  = Math.max(0, Math.min(this._patternW - 1, xi));
    const y  = Math.max(0, Math.min(this._patternH - 1, yi));
    return this._pattern[y * this._patternW + x];
  },
};

export default atmosphereAgent;
