// insolation — top-of-atmosphere shortwave irradiance.
//
// Self-contained: owns its cell grid (this.lats × this.lons) and a Float32Array for tsi_w_m2.
// Seeds bus.time from this.t0 on registration so event.t is an absolute Unix timestamp.
// No dependency on bus.world.
//
// bus.insolation.cells()        — Array<{ idx, lat, lon, token }>
// bus.insolation.at(idx)        — tsi_w_m2 for cell at index idx (W/m²)
// bus.insolation.sample(lon,lat) — tsi_w_m2 at nearest cell

const SOLAR_CONSTANT = 1361; // W/m² at 1 AU
const DEG = Math.PI / 180;

function dayOfYear(date) {
  return (date - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000;
}
function declination(date) {
  return 23.45 * DEG * Math.sin(2 * Math.PI * (284 + dayOfYear(date)) / 365);
}
function eccentricity(date) {
  return 1 + 0.033 * Math.cos(2 * Math.PI * dayOfYear(date) / 365);
}
function hourAngle(date, lon) {
  const h = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return ((h + lon / 15) - 12) * 15 * DEG;
}

function compute(cells, tsi, tUnixSeconds) {
  const date = new Date(tUnixSeconds * 1000);
  const decl = declination(date);
  const S = SOLAR_CONSTANT * eccentricity(date);
  for (const cell of cells) {
    const lat = cell.lat * DEG;
    const H = hourAngle(date, cell.lon);
    const cosZ = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H);
    tsi[cell.idx] = cosZ > 0 ? S * cosZ : 0;
  }
}

const insolationAgent = {
  id: 'insolation',
  lats: [-60, -30, 0, 30, 60],
  lons: [-120, 0, 120],
  t0: '2026-06-21T12:00:00Z',

  resolve(event, bus) {
    if (event.registered) {
      const cells = [];
      for (const lat of this.lats)
        for (const lon of this.lons)
          cells.push({ idx: cells.length, lat, lon, token: `cell:${lat}:${lon}` });

      const tsi = new Float32Array(cells.length);

      if (this.t0) bus.time = new Date(this.t0).getTime() / 1000;

      bus.install('insolation', {
        cells: () => cells,
        at:     (idx) => tsi[idx],
        sample: (lon, lat) => {
          let best = cells[0], bestDist = Infinity;
          for (const c of cells) {
            const d = (c.lon - lon) ** 2 + (c.lat - lat) ** 2;
            if (d < bestDist) { bestDist = d; best = c; }
          }
          return tsi[best.idx];
        },
      });

      this._cells = cells;
      this._tsi = tsi;
      compute(cells, tsi, bus.time);
      return;
    }

    if (event.tick) {
      if (this._cells) compute(this._cells, this._tsi, event.t);
    }
  },
};

export default insolationAgent;
