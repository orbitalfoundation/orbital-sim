// ucdp — Uppsala Conflict Data Program georeferenced events.
//
// Downloads the UCDP Georeferenced Event Dataset (GED) — the gold standard for
// historical conflict research. No API key required.
//
// Coverage: 1989 – ~2023 (updated annually each spring).
// Quality: manually vetted, very high precision.
// Size: ~45 MB compressed → ~200 MB CSV → ~20,000 Gulf events after filtering.
//
// Gulf bounding box filter: lat 12–35°N, lon 44–62°E
// Covers: Iran, Iraq, Yemen, Saudi Arabia, Kuwait, Bahrain, Qatar, UAE, Oman, Syria.
//
// bus.ucdp installs:
//   .events_near(lon, lat, radiusKm)  — conflict events within radius
//   .events_since(year)               — events in or after a given year
//   .count()                          — total Gulf events in DB
//   .latest_year()                    — most recent event year
//   .summary()                        — events and deaths by country and type
//
// TTL: 30 days (dataset updates annually; checking monthly is more than enough).

import { createInterface }  from 'node:readline';
import { Readable }         from 'node:stream';
import { join }             from 'node:path';
import unzipper             from 'unzipper';
import { getDb, DATA_DIR }  from '../lib/db.js';

// UCDP GED 24.1 — events 1989–2023
// Check https://ucdp.uu.se/downloads/ for the latest version number.
const UCDP_VERSION  = '241';
const UCDP_ZIP_URL  = `https://ucdp.uu.se/downloads/ged/ged${UCDP_VERSION}-csv.zip`;

// Gulf bounding box
const BBOX = { latMin: 12, latMax: 35, lonMin: 44, lonMax: 62 };

// ---------- schema ----------

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS ucdp_events (
    id              INTEGER PRIMARY KEY,
    year            INTEGER NOT NULL,
    type_of_violence INTEGER,
    conflict_name   TEXT,
    side_a          TEXT,
    side_b          TEXT,
    country         TEXT,
    adm_1           TEXT,
    where_description TEXT,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    date_start      TEXT,
    date_end        TEXT,
    date_prec       INTEGER,
    where_prec      INTEGER,
    deaths_best     INTEGER DEFAULT 0,
    deaths_low      INTEGER DEFAULT 0,
    deaths_high     INTEGER DEFAULT 0,
    deaths_civilians INTEGER DEFAULT 0,
    version         TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_ucdp_latlon  ON ucdp_events(latitude, longitude);
  CREATE INDEX IF NOT EXISTS idx_ucdp_year    ON ucdp_events(year);
  CREATE INDEX IF NOT EXISTS idx_ucdp_country ON ucdp_events(country);
  CREATE INDEX IF NOT EXISTS idx_ucdp_type    ON ucdp_events(type_of_violence);

  CREATE TABLE IF NOT EXISTS ucdp_meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`;

// ---------- module-level shared state ----------

let _initialised = false;
let _syncing     = false;
let _lastSync    = 0;
const TTL_MS     = 30 * 24 * 60 * 60 * 1000; // 30 days

// ---------- CSV streaming ----------

// Parse UCDP CSV streamed from zip entry. Yields row objects for Gulf events only.
async function* streamGulfEvents(zipEntry) {
  const rl = createInterface({ input: zipEntry, crlfDelay: Infinity });

  let headers = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    // UCDP CSV uses comma separation; fields may be quoted
    const cols = parseCSVLine(line);
    if (!headers) { headers = cols; continue; }

    const row = Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']));
    const lat = parseFloat(row.latitude);
    const lon = parseFloat(row.longitude);
    if (!isFinite(lat) || !isFinite(lon)) continue;
    if (lat < BBOX.latMin || lat > BBOX.latMax) continue;
    if (lon < BBOX.lonMin || lon > BBOX.lonMax) continue;

    yield row;
  }
}

// Minimal CSV parser — handles quoted fields with embedded commas.
function parseCSVLine(line) {
  const cols = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { cols.push(cur); cur = ''; continue; }
    cur += c;
  }
  cols.push(cur);
  return cols;
}

// ---------- DB operations ----------

function initSchema(db) {
  db.exec(SCHEMA);
}

function getLastSyncVersion(db) {
  return db.prepare("SELECT value FROM ucdp_meta WHERE key='version'").get()?.value ?? null;
}

function setVersion(db, version) {
  db.prepare("INSERT OR REPLACE INTO ucdp_meta(key,value) VALUES('version',?)").run(version);
}

// ---------- sync ----------

async function sync(db) {
  if (_syncing) return;
  _syncing = true;

  console.log(`[ucdp] downloading GED ${UCDP_VERSION} from UCDP…`);
  try {
    // Clear existing data before reload (version bump)
    db.prepare('DELETE FROM ucdp_events').run();

    const res = await fetch(UCDP_ZIP_URL, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Stream zip → CSV entry → Gulf event rows → SQLite
    const readable = Readable.fromWeb(res.body);
    const zip      = readable.pipe(unzipper.Parse({ forceStream: true }));

    let inserted = 0;
    for await (const entry of zip) {
      if (entry.path.toLowerCase().endsWith('.csv')) {
        inserted = await insertEventsAsync(db, entry);
      } else {
        entry.autodrain();
      }
    }

    setVersion(db, UCDP_VERSION);
    _lastSync = Date.now();
    const total = db.prepare('SELECT COUNT(*) c FROM ucdp_events').get().c;
    console.log(`[ucdp] loaded ${total} Gulf events (${UCDP_VERSION})`);

  } catch (err) {
    console.error(`[ucdp] sync failed: ${err.message}`);
  } finally {
    _syncing = false;
  }
}

async function insertEventsAsync(db, zipEntry) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO ucdp_events
      (id, year, type_of_violence, conflict_name, side_a, side_b, country,
       adm_1, where_description, latitude, longitude,
       date_start, date_end, date_prec, where_prec,
       deaths_best, deaths_low, deaths_high, deaths_civilians, version)
    VALUES
      (@id, @year, @type, @conflict, @side_a, @side_b, @country,
       @adm_1, @where_desc, @lat, @lon,
       @date_start, @date_end, @date_prec, @where_prec,
       @deaths_best, @deaths_low, @deaths_high, @deaths_civilians, @version)
  `);
  const tx = db.transaction(batch => { for (const r of batch) stmt.run(r); });

  let batch = [], total = 0;
  for await (const r of streamGulfEvents(zipEntry)) {
    batch.push({
      id:           Number(r.id),
      year:         Number(r.year),
      type:         Number(r.type_of_violence) || null,
      conflict:     r.conflict_name ?? null,
      side_a:       r.side_a ?? null,
      side_b:       r.side_b ?? null,
      country:      r.country ?? null,
      adm_1:        r.adm_1 ?? null,
      where_desc:   r.where_description ?? null,
      lat:          parseFloat(r.latitude),
      lon:          parseFloat(r.longitude),
      date_start:   r.date_start ?? null,
      date_end:     r.date_end ?? null,
      date_prec:    Number(r.date_prec) || null,
      where_prec:   Number(r.where_prec) || null,
      deaths_best:  Number(r.best)  || 0,
      deaths_low:   Number(r.low)   || 0,
      deaths_high:  Number(r.high)  || 0,
      deaths_civilians: Number(r.deaths_civilians) || 0,
      version:      UCDP_VERSION,
    });
    if (batch.length >= 500) { tx(batch); total += batch.length; batch = []; }
  }
  if (batch.length) { tx(batch); total += batch.length; }
  return total;
}

// ---------- spatial ----------

const DEG = Math.PI / 180;
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * DEG, dLon = (lon2 - lon1) * DEG;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*DEG)*Math.cos(lat2*DEG)*Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ---------- agent ----------

const ucdpAgent = {
  id:    'ucdp',
  ttlMs: TTL_MS,

  async resolve(event, bus) {
    if (event.registered) {
      const db = getDb();
      if (!_initialised) { initSchema(db); _initialised = true; }

      const storedVersion = getLastSyncVersion(db);
      if (storedVersion !== UCDP_VERSION) {
        // New version available or first run — sync in background
        sync(db);
      } else {
        _lastSync = Date.now(); // already current
      }

      bus.install('ucdp', {
        events_near(lon, lat, radiusKm = 200) {
          const d = (radiusKm / 111) * 1.1;
          const rows = db.prepare(`
            SELECT * FROM ucdp_events
            WHERE latitude  BETWEEN ? AND ?
              AND longitude BETWEEN ? AND ?
            ORDER BY year DESC
          `).all(lat-d, lat+d, lon-d, lon+d);
          return rows.filter(r => haversine(lat, lon, r.latitude, r.longitude) <= radiusKm);
        },
        events_since: (year) => db.prepare(
          'SELECT * FROM ucdp_events WHERE year >= ? ORDER BY year DESC'
        ).all(year),
        count: () => db.prepare('SELECT COUNT(*) c FROM ucdp_events').get()?.c ?? 0,
        latest_year: () => db.prepare('SELECT MAX(year) y FROM ucdp_events').get()?.y ?? null,
        summary: () => db.prepare(`
          SELECT country, type_of_violence, COUNT(*) events, SUM(deaths_best) deaths
          FROM ucdp_events GROUP BY country, type_of_violence ORDER BY deaths DESC
        `).all(),
      });

      const count = db.prepare('SELECT COUNT(*) c FROM ucdp_events').get()?.c ?? 0;
      console.log(`[ucdp] ready: ${count} Gulf events (version ${storedVersion ?? 'syncing…'})`);
      return;
    }

    if (event.ucdp_query) {
      const q = event.ucdp_query;
      if (!bus.ucdp) return null;
      if (q.near)    return bus.ucdp.events_near(q.near.lon, q.near.lat, q.near.radius ?? 200);
      if (q.since)   return bus.ucdp.events_since(q.since);
      if (q.count)   return bus.ucdp.count();
      if (q.latest)  return bus.ucdp.latest_year();
      if (q.summary) return bus.ucdp.summary();
      return null;
    }

    if (event.tick && !_syncing && Date.now() - _lastSync > this.ttlMs) {
      sync(getDb());
    }
  },
};

export default ucdpAgent;
