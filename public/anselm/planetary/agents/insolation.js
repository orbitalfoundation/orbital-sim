// insolation — top-of-atmosphere shortwave irradiance per cell.
//
// Pure astronomical forcing. Writes tsi_w_m2 to bus.world every tick (and
// once at load so the initial state has values).
//
// Physics: Cooper 1969 declination, eccentricity correction, hour angle from
// UTC + cell longitude. Not modelled: atmosphere, clouds, slope/aspect.

const SOLAR_CONSTANT = 1361; // W/m^2 at 1 AU
const DEG = Math.PI / 180;

function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return (date.getTime() - start) / 86_400_000;
}
function solarDeclinationRad(date) {
  const n = dayOfYear(date);
  return 23.45 * DEG * Math.sin(2 * Math.PI * (284 + n) / 365);
}
function eccentricityFactor(date) {
  const n = dayOfYear(date);
  return 1 + 0.033 * Math.cos(2 * Math.PI * n / 365);
}
function hourAngleRad(date, lonDeg) {
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const localSolarHour = utcHours + lonDeg / 15;
  return (localSolarHour - 12) * 15 * DEG;
}

const baseAgent = {
  id: 'insolation',

  resolve(event, bus) {
    const world = bus.world;
    if (!world) return;

    if (event.tick) world.advance(event.dt);
    if (!event.tick && !event.load) return;

    const t = world.time();
    const decl = solarDeclinationRad(t);
    const S    = SOLAR_CONSTANT * eccentricityFactor(t);
    for (const cell of world.cells()) {
      const lat = cell.lat * DEG;
      const H   = hourAngleRad(t, cell.lon);
      const cosZ = Math.sin(lat) * Math.sin(decl)
                 + Math.cos(lat) * Math.cos(decl) * Math.cos(H);
      world.setField(cell.token, 'tsi_w_m2', cosZ > 0 ? S * cosZ : 0);
    }
  },
};

baseAgent.resolve.after = 'world';

export default baseAgent;
