// cities — world cities from GeoNames.
//
// Downloads cities15000.txt from GeoNames — all cities with population > 15,000.
// ~24,000 cities globally. No API key required. Creative Commons license.
//
// bus.cities installs:
//   .near(lon, lat, radiusKm)   — cities within radius, sorted by population
//   .search(name)               — cities matching name prefix
//   .byCountry(code)            — all cities in a country (ISO 2-letter)
//   .largest(n)                 — top N cities by population globally
//   .count()                    — total cities in DB

import { createInterface } from 'node:readline';
import { Readable }        from 'node:stream';
import unzipper            from 'unzipper';
import { getDb }           from '../lib/db.js';

const GEONAMES_URL = 'https://download.geonames.org/export/dump/cities15000.zip';
const TTL_MS       = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ROWS     = 30_000;                     // safety cap (dataset is ~24K anyway)

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS cities (
    id           INTEGER PRIMARY KEY,
    name         TEXT NOT NULL,
    ascii_name   TEXT,
    country_code TEXT,
    admin1_code  TEXT,
    latitude     REAL NOT NULL,
    longitude    REAL NOT NULL,
    population   INTEGER DEFAULT 0,
    timezone     TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_cities_latlon   ON cities(latitude, longitude);
  CREATE INDEX IF NOT EXISTS idx_cities_country  ON cities(country_code);
  CREATE INDEX IF NOT EXISTS idx_cities_name     ON cities(ascii_name);
  CREATE INDEX IF NOT EXISTS idx_cities_pop      ON cities(population);

  CREATE TABLE IF NOT EXISTS cities_meta (
    key TEXT PRIMARY KEY, value TEXT
  );
`;

let _initialised = false;
let _syncing     = false;
let _lastSync    = 0;

function initSchema(db) { db.exec(SCHEMA); }

function getLastSync(db) {
  return Number(db.prepare("SELECT value FROM cities_meta WHERE key='last_sync'").get()?.value ?? 0);
}

function setLastSync(db) {
  db.prepare("INSERT OR REPLACE INTO cities_meta(key,value) VALUES('last_sync',?)")
    .run(String(Date.now()));
}

async function sync(db) {
  if (_syncing) return;
  _syncing = true;
  console.log('[cities] downloading GeoNames cities15000…');
  try {
    db.prepare('DELETE FROM cities').run();

    const res = await fetch(GEONAMES_URL, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO cities(id, name, ascii_name, country_code, admin1_code,
                                   latitude, longitude, population, timezone)
      VALUES (@id,@name,@ascii,@cc,@adm1,@lat,@lon,@pop,@tz)
    `);
    const tx   = db.transaction(batch => { for (const r of batch) stmt.run(r); });

    const readable = Readable.fromWeb(res.body);
    const zip      = readable.pipe(unzipper.Parse({ forceStream: true }));

    let batch = [], total = 0;
    for await (const entry of zip) {
      if (!entry.path.endsWith('.txt')) { entry.autodrain(); continue; }
      const rl = createInterface({ input: entry, crlfDelay: Infinity });
      for await (const line of rl) {
        const f = line.split('\t');
        if (f.length < 19) continue;
        const lat = parseFloat(f[4]), lon = parseFloat(f[5]);
        if (!isFinite(lat) || !isFinite(lon)) continue;
        batch.push({ id: Number(f[0]), name: f[1], ascii: f[2], cc: f[8],
                     adm1: f[10], lat, lon, pop: Number(f[14]) || 0, tz: f[17] });
        if (batch.length >= 500) { tx(batch); total += batch.length; batch = []; }
        if (total >= MAX_ROWS) break;
      }
      if (batch.length) { tx(batch); total += batch.length; }
    }

    setLastSync(db);
    _lastSync = Date.now();
    console.log(`[cities] loaded ${total} cities`);
  } catch (err) {
    console.error(`[cities] sync failed: ${err.message}`);
  } finally {
    _syncing = false;
  }
}

const DEG = Math.PI / 180;
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = (lat2-lat1)*DEG, dLon = (lon2-lon1)*DEG;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*DEG)*Math.cos(lat2*DEG)*Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const citiesAgent = {
  id:    'cities',
  ttlMs: TTL_MS,

  async resolve(event, bus) {
    if (event.registered) {
      const db = getDb();
      if (!_initialised) { initSchema(db); _initialised = true; }

      const storedSync = getLastSync(db);
      if (!storedSync || Date.now() - storedSync > this.ttlMs) sync(db);
      else _lastSync = storedSync;

      bus.install('cities', {
        near(lon, lat, radiusKm = 100) {
          const d = (radiusKm / 111) * 1.2;
          const rows = db.prepare(`
            SELECT * FROM cities
            WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
            ORDER BY population DESC
          `).all(lat-d, lat+d, lon-d, lon+d);
          return rows
            .filter(r => haversine(lat, lon, r.latitude, r.longitude) <= radiusKm)
            .sort((a, b) => b.population - a.population);
        },
        search: (name) => db.prepare(
          "SELECT * FROM cities WHERE ascii_name LIKE ? ORDER BY population DESC LIMIT 20"
        ).all(`${name}%`),
        byCountry: (code) => db.prepare(
          'SELECT * FROM cities WHERE country_code = ? ORDER BY population DESC'
        ).all(code.toUpperCase()),
        largest: (n = 100) => db.prepare(
          'SELECT * FROM cities ORDER BY population DESC LIMIT ?'
        ).all(n),
        count: () => db.prepare('SELECT COUNT(*) c FROM cities').get()?.c ?? 0,
        all:   () => db.prepare('SELECT id,name,country_code,latitude,longitude,population FROM cities').all(),
      });

      const count = db.prepare('SELECT COUNT(*) c FROM cities').get()?.c ?? 0;
      console.log(`[cities] ready: ${count} cities${count === 0 ? ' (syncing…)' : ''}`);
      return;
    }
    if (event.cities_query) {
      const q = event.cities_query;
      if (!bus.cities) return null;
      if (q.near)              return bus.cities.near(q.near.lon, q.near.lat, q.near.radius ?? 100);
      if (q.search  != null)   return bus.cities.search(q.search);
      if (q.byCountry != null) return bus.cities.byCountry(q.byCountry);
      if (q.largest != null)   return bus.cities.largest(q.largest);
      if (q.count)             return bus.cities.count();
      if (q.all)               return bus.cities.all();
      return null;
    }

    if (event.tick && !_syncing && Date.now() - _lastSync > this.ttlMs) sync(getDb());
  },
};

export default citiesAgent;
