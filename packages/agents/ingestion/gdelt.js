// gdelt — Global Database of Events, Language, and Tone (GDELT 2.0).
//
// No API key required. Updated every 15 minutes. Covers the current crisis.
//
// GDELT monitors world news in 100+ languages. Events are auto-coded using
// CAMEO (Conflict and Mediation Event Observations) taxonomy. Coverage is broad
// but noisier than ACLED or UCDP — the same real-world event may generate
// many records from different news sources.
//
// This agent keeps a rolling 90-day window of Gulf conflict events.
// Filters applied:
//   - ActionGeo_CountryCode in Gulf FIPS codes
//   - QuadClass 3 (verbal conflict) or 4 (material conflict)
//   - ActionGeo_Lat/Lon non-zero (has geographic data)
//
// bus.gdelt installs:
//   .events_near(lon, lat, radiusKm)  — recent conflict events within radius
//   .events_since(isoDate)            — events on or after a date
//   .count()                          — total events in rolling window
//   .latest_date()                    — most recent event date
//   .hot_spots()                      — lat/lon clusters with high activity
//
// TTL: 15 minutes (matches GDELT update frequency).
// Rolling window: 90 days (older events are pruned to keep DB small).

import { createInterface } from 'node:readline';
import { Readable }        from 'node:stream';
import unzipper            from 'unzipper';
import { getDb }           from '../lib/db.js';

// GDELT 2.0 endpoints
const GDELT_LASTUPDATE = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt';

// Gulf country codes (FIPS 10-4 standard used by GDELT)
const GULF_FIPS = new Set(['IR','IZ','SA','KU','BA','QA','AE','MU','YE','SY']);

// CAMEO QuadClass: 3 = verbal conflict, 4 = material conflict
const CONFLICT_CLASSES = new Set([3, 4]);

// Rolling window: keep last N days of events
const WINDOW_DAYS  = 90;
const TTL_MS       = 15 * 60 * 1000; // 15 minutes

// ---------- schema ----------

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS gdelt_events (
    event_id        INTEGER PRIMARY KEY,
    event_date      TEXT NOT NULL,
    actor1_country  TEXT,
    actor2_country  TEXT,
    event_code      TEXT,
    event_root_code TEXT,
    quad_class      INTEGER,
    goldstein_scale REAL,
    num_mentions    INTEGER DEFAULT 0,
    num_articles    INTEGER DEFAULT 0,
    avg_tone        REAL,
    action_country  TEXT,
    action_adm1     TEXT,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    source_url      TEXT,
    fetched_at      TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_gdelt_latlon ON gdelt_events(latitude, longitude);
  CREATE INDEX IF NOT EXISTS idx_gdelt_date   ON gdelt_events(event_date);
  CREATE INDEX IF NOT EXISTS idx_gdelt_quad   ON gdelt_events(quad_class);
`;

// GDELT 2.0 export TSV column indices (0-based, 58 total columns)
// https://www.gdeltproject.org/data/lookups/CSV.header.fieldids.xlsx
const COL = {
  EVENTID:     0,
  SQLDATE:     1,
  A1_COUNTRY: 7,
  A2_COUNTRY: 15,
  EVENTCODE:  26,
  ROOTCODE:   27,
  QUADCLASS:  29,
  GOLDSTEIN:  30,
  MENTIONS:   31,
  ARTICLES:   33,
  AVGTONE:    34,
  ACT_TYPE:   35,
  ACT_FULL:   36,
  ACT_COUNTRY:37,
  ACT_ADM1:   38,
  ACT_LAT:    40,
  ACT_LON:    41,
  SOURCEURL:  57,
};

// ---------- module-level shared state ----------

let _initialised = false;
let _syncing     = false;
let _lastSync    = 0;

// ---------- parse GDELT last-update file ----------

async function getLatestFileUrl() {
  const res  = await fetch(GDELT_LASTUPDATE, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`lastupdate fetch HTTP ${res.status}`);
  const text = await res.text();
  // First line is the export (events) file
  const line = text.trim().split('\n')[0];
  return line.split(' ')[1]; // "SIZE URL"
}

// ---------- stream and filter GDELT events ----------

async function* streamGulfConflicts(zipUrl) {
  const res = await fetch(zipUrl, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`GDELT file HTTP ${res.status}`);

  const readable = Readable.fromWeb(res.body);
  const zip      = readable.pipe(unzipper.Parse({ forceStream: true }));

  for await (const entry of zip) {
    if (!entry.path.toLowerCase().endsWith('.csv') && !entry.path.toLowerCase().endsWith('.tsv')) {
      entry.autodrain(); continue;
    }
    const rl = createInterface({ input: entry, crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      const f = line.split('\t');
      if (f.length < 58) continue;

      const quad    = Number(f[COL.QUADCLASS]);
      if (!CONFLICT_CLASSES.has(quad)) continue;

      const country = f[COL.ACT_COUNTRY];
      if (!GULF_FIPS.has(country)) continue;

      const lat = parseFloat(f[COL.ACT_LAT]);
      const lon = parseFloat(f[COL.ACT_LON]);
      if (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0)) continue;

      yield {
        event_id:       Number(f[COL.EVENTID]) || null,
        event_date:     f[COL.SQLDATE],
        actor1_country: f[COL.A1_COUNTRY] || null,
        actor2_country: f[COL.A2_COUNTRY] || null,
        event_code:     f[COL.EVENTCODE]  || null,
        event_root_code:f[COL.ROOTCODE]   || null,
        quad_class:     quad,
        goldstein_scale:parseFloat(f[COL.GOLDSTEIN]) || null,
        num_mentions:   Number(f[COL.MENTIONS]) || 0,
        num_articles:   Number(f[COL.ARTICLES]) || 0,
        avg_tone:       parseFloat(f[COL.AVGTONE]) || null,
        action_country: country,
        action_adm1:    f[COL.ACT_ADM1] || null,
        latitude:       lat,
        longitude:      lon,
        source_url:     f[COL.SOURCEURL] || null,
      };
    }
  }
}

// ---------- DB ----------

function initSchema(db) { db.exec(SCHEMA); }

function pruneOldEvents(db) {
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86400 * 1000)
    .toISOString().slice(0, 10).replace(/-/g, '');
  const { changes } = db.prepare(
    'DELETE FROM gdelt_events WHERE event_date < ?'
  ).run(cutoff);
  if (changes > 0) console.log(`[gdelt] pruned ${changes} events older than ${cutoff}`);
}

async function insertEvents(db, eventStream) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO gdelt_events
      (event_id, event_date, actor1_country, actor2_country, event_code,
       event_root_code, quad_class, goldstein_scale, num_mentions, num_articles,
       avg_tone, action_country, action_adm1, latitude, longitude, source_url)
    VALUES
      (@event_id, @event_date, @actor1_country, @actor2_country, @event_code,
       @event_root_code, @quad_class, @goldstein_scale, @num_mentions, @num_articles,
       @avg_tone, @action_country, @action_adm1, @latitude, @longitude, @source_url)
  `);
  const tx = db.transaction(batch => { for (const r of batch) stmt.run(r); });
  let batch = [], total = 0;
  for await (const r of eventStream) {
    batch.push(r);
    if (batch.length >= 500) { tx(batch); total += batch.length; batch = []; }
  }
  if (batch.length) { tx(batch); total += batch.length; }
  return total;
}

// ---------- sync ----------

async function sync(db) {
  if (_syncing) return;
  _syncing = true;
  try {
    console.log(`[gdelt] checking ${GDELT_LASTUPDATE}`);
    const zipUrl  = await getLatestFileUrl();
    const ts      = zipUrl.match(/(\d{14})/)?.[1] ?? 'unknown';
    console.log(`[gdelt] fetching update ${ts} from ${zipUrl}`);

    const inserted = await insertEvents(db, streamGulfConflicts(zipUrl));
    pruneOldEvents(db);
    _lastSync = Date.now();

    const total = db.prepare('SELECT COUNT(*) c FROM gdelt_events').get()?.c ?? 0;
    console.log(`[gdelt] +${inserted} events (${total} total in ${WINDOW_DAYS}-day window)`);
  } catch (err) {
    console.error(`[gdelt] sync failed: ${err.message}`);
  } finally {
    _syncing = false;
  }
}

// ---------- spatial ----------

const DEG = Math.PI / 180;
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * DEG, dLon = (lon2 - lon1) * DEG;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*DEG)*Math.cos(lat2*DEG)*Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ---------- agent ----------

const gdeltAgent = {
  id:    'gdelt',
  ttlMs: TTL_MS,

  async resolve(event, bus) {
    if (event.registered) {
      const db = getDb();
      if (!_initialised) { initSchema(db); _initialised = true; }

      // Sync immediately on first registration
      sync(db);

      bus.install('gdelt', {
        events_near(lon, lat, radiusKm = 200) {
          const d = (radiusKm / 111) * 1.1;
          const rows = db.prepare(`
            SELECT * FROM gdelt_events
            WHERE latitude  BETWEEN ? AND ?
              AND longitude BETWEEN ? AND ?
            ORDER BY event_date DESC
            LIMIT 5000
          `).all(lat-d, lat+d, lon-d, lon+d);
          return rows.filter(r => haversine(lat, lon, r.latitude, r.longitude) <= radiusKm);
        },

        events_on: (isoDate) => {
          const ymd = isoDate.replace(/-/g, '');
          return db.prepare(
            'SELECT * FROM gdelt_events WHERE event_date = ? ORDER BY num_mentions DESC LIMIT 2000'
          ).all(ymd);
        },

        events_since: (isoDate) => {
          const ymd = isoDate.replace(/-/g, '');
          return db.prepare(
            'SELECT * FROM gdelt_events WHERE event_date >= ? ORDER BY event_date DESC'
          ).all(ymd);
        },

        count: () => db.prepare('SELECT COUNT(*) c FROM gdelt_events').get()?.c ?? 0,

        latest_date: () => {
          const d = db.prepare('SELECT MAX(event_date) d FROM gdelt_events').get()?.d;
          return d ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : null;
        },

        available_dates: () => db.prepare(
          'SELECT DISTINCT event_date d FROM gdelt_events ORDER BY d'
        ).all().map(r => {
          const s = String(r.d);
          return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
        }),

        // Simple grid-based hot-spot summary (1° cells)
        hot_spots: () => db.prepare(`
          SELECT ROUND(latitude) lat, ROUND(longitude) lon,
                 COUNT(*) events, AVG(goldstein_scale) avg_tone
          FROM gdelt_events
          GROUP BY ROUND(latitude), ROUND(longitude)
          HAVING events > 5
          ORDER BY events DESC
          LIMIT 50
        `).all(),
      });

      const count = db.prepare('SELECT COUNT(*) c FROM gdelt_events').get()?.c ?? 0;
      console.log(`[gdelt] ready: ${count} events in ${WINDOW_DAYS}-day Gulf window (syncing…)`);
      return;
    }

    if (event.gdelt_query) {
      const q = event.gdelt_query;
      if (!bus.gdelt) return null;
      if (q.date)    return bus.gdelt.events_on(q.date);
      if (q.since)   return bus.gdelt.events_since(q.since);
      if (q.near)    return bus.gdelt.events_near(q.near.lon, q.near.lat, q.near.radius ?? 200);
      if (q.dates)   return bus.gdelt.available_dates();
      if (q.count)   return bus.gdelt.count();
      if (q.latest)  return bus.gdelt.latest_date();
      return null;
    }

    // Realtime: refresh every 15 minutes
    if (event.tick && !_syncing && Date.now() - _lastSync > this.ttlMs) {
      sync(getDb());
    }
  },
};

export default gdeltAgent;
