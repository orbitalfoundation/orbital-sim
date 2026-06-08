// acled — Armed Conflict Location and Event Data agent.
//
// Fetches and caches conflict events from the ACLED API (https://acleddata.com/).
// Implements stale-while-revalidate: serves from SQLite immediately, refreshes
// in the background when data is older than ttlMs.
//
// Requires registration at https://acleddata.com/ for a free API key (research use).
// Set in environment:
//   ACLED_KEY   — API key from ACLED dashboard
//   ACLED_EMAIL — email address used to register
//
// Module-level singleton: one DB connection, one sync cycle, shared across all
// bus instances in the process. Multiple concurrent Hormuz simulations share the
// same event cache — no duplicate fetches.
//
// bus.acled installs:
//   .events_near(lon, lat, radiusKm)      — events within radius (bounding box + haversine)
//   .events_since(isoDate)                — all events on or after a date
//   .events_in(countries)                 — events in named countries (array)
//   .count()                              — total events in DB
//   .latest_date()                        — most recent event date (ISO string)
//   .summary()                            — aggregate stats by country and event type
//
// Default region: Persian Gulf + adjacent (covers Hormuz scenario).
// Override via agent config: { countries: ['...'], since_years: 2 }

import { getDb } from './lib/db.js';

// ---------- schema ----------

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS acled_events (
    data_id       TEXT    PRIMARY KEY,
    event_date    TEXT    NOT NULL,
    year          INTEGER NOT NULL,
    event_type    TEXT,
    sub_event_type TEXT,
    actor1        TEXT,
    actor2        TEXT,
    country       TEXT,
    iso           TEXT,
    admin1        TEXT,
    location      TEXT,
    latitude      REAL    NOT NULL,
    longitude     REAL    NOT NULL,
    geo_precision INTEGER,
    fatalities    INTEGER DEFAULT 0,
    notes         TEXT,
    source        TEXT,
    acled_ts      INTEGER,
    fetched_at    TEXT    DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_acled_latlon ON acled_events(latitude, longitude);
  CREATE INDEX IF NOT EXISTS idx_acled_date   ON acled_events(event_date);
  CREATE INDEX IF NOT EXISTS idx_acled_type   ON acled_events(event_type);
  CREATE INDEX IF NOT EXISTS idx_acled_country ON acled_events(country);

  CREATE TABLE IF NOT EXISTS acled_meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`;

// ---------- module-level shared state ----------

let _initialised = false;
let _syncing     = false;
let _lastSync    = 0;      // wall-clock ms of last completed sync
const _SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

// ---------- ACLED API ----------

const ACLED_URL = 'https://api.acleddata.com/acled/read';

// Gulf + adjacent countries — covers Hormuz scenario plus regional context.
const DEFAULT_COUNTRIES = [
  'Iran', 'Iraq', 'Saudi Arabia', 'Kuwait', 'Bahrain',
  'Qatar', 'United Arab Emirates', 'Oman', 'Yemen', 'Syria',
];

function buildUrl({ key, email, countries, sinceTs, page }) {
  const p = new URLSearchParams({
    key,
    email,
    country:    countries.join('|'),
    limit:      '500',
    page:       String(page),
    fields:     'data_id|event_date|year|event_type|sub_event_type|actor1|actor2|country|iso|admin1|location|latitude|longitude|geo_precision|fatalities|notes|source|timestamp',
  });
  if (sinceTs) p.set('since', String(sinceTs));
  return `${ACLED_URL}?${p}`;
}

async function fetchPage({ key, email, countries, sinceTs, page }) {
  const url = buildUrl({ key, email, countries, sinceTs, page });
  const res  = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`ACLED HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (!json.success) throw new Error(`ACLED error: ${JSON.stringify(json)}`);
  return json.data ?? [];
}

// ---------- DB operations ----------

function initSchema(db) {
  db.exec(SCHEMA);
}

function upsertEvents(db, events) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO acled_events
      (data_id, event_date, year, event_type, sub_event_type, actor1, actor2,
       country, iso, admin1, location, latitude, longitude, geo_precision,
       fatalities, notes, source, acled_ts)
    VALUES
      (@data_id, @event_date, @year, @event_type, @sub_event_type, @actor1, @actor2,
       @country, @iso, @admin1, @location, @latitude, @longitude, @geo_precision,
       @fatalities, @notes, @source, @acled_ts)
  `);
  const insert = db.transaction(rows => { for (const r of rows) stmt.run(r); });
  const rows = events.map(e => ({
    data_id:        e.data_id,
    event_date:     e.event_date,
    year:           Number(e.year),
    event_type:     e.event_type ?? null,
    sub_event_type: e.sub_event_type ?? null,
    actor1:         e.actor1 ?? null,
    actor2:         e.actor2 ?? null,
    country:        e.country ?? null,
    iso:            e.iso ?? null,
    admin1:         e.admin1 ?? null,
    location:       e.location ?? null,
    latitude:       Number(e.latitude),
    longitude:      Number(e.longitude),
    geo_precision:  Number(e.geo_precision) || null,
    fatalities:     Number(e.fatalities) || 0,
    notes:          e.notes ?? null,
    source:         e.source ?? null,
    acled_ts:       Number(e.timestamp) || null,
  }));
  insert(rows);
  return rows.length;
}

function getLastSyncTs(db) {
  const row = db.prepare("SELECT value FROM acled_meta WHERE key='last_sync_ts'").get();
  return row ? Number(row.value) : null;
}

function setLastSyncTs(db, ts) {
  db.prepare("INSERT OR REPLACE INTO acled_meta(key,value) VALUES('last_sync_ts',?)").run(String(ts));
}

// ---------- sync ----------

async function sync(db, { key, email, countries, sinceYears = 2 }) {
  if (_syncing) return;
  _syncing = true;

  const lastTs = getLastSyncTs(db);
  const sinceTs = lastTs
    ? lastTs
    : Math.floor((Date.now() - sinceYears * 365.25 * 86400 * 1000) / 1000);

  const sinceDate = new Date(sinceTs * 1000).toISOString().slice(0, 10);
  console.log(`[acled] syncing from ${sinceDate} (${countries.length} countries)…`);

  let totalInserted = 0;
  let page = 1;
  let maxTs = lastTs ?? sinceTs;

  try {
    while (true) {
      const events = await fetchPage({ key, email, countries, sinceTs, page });
      if (!events.length) break;

      const inserted = upsertEvents(db, events);
      totalInserted += inserted;

      // Track newest timestamp seen
      for (const e of events) {
        const ts = Number(e.timestamp);
        if (ts > maxTs) maxTs = ts;
      }

      console.log(`[acled] page ${page}: ${events.length} events (${inserted} new)`);

      if (events.length < 500) break;  // last page

      page++;
      // Polite rate limiting — 1 request per second
      await new Promise(r => setTimeout(r, 1000));
    }

    setLastSyncTs(db, maxTs || Math.floor(Date.now() / 1000));
    _lastSync = Date.now();
    console.log(`[acled] sync complete: ${totalInserted} new events (total: ${db.prepare('SELECT COUNT(*) c FROM acled_events').get().c})`);

  } catch (err) {
    console.error(`[acled] sync failed: ${err.message} — serving stale data`);
  } finally {
    _syncing = false;
  }
}

// ---------- spatial queries ----------

const DEG = Math.PI / 180;
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * DEG;
  const dLon = (lon2 - lon1) * DEG;
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bboxDeg(radiusKm) {
  // Approximate degrees for bounding box pre-filter (~1.1° per 100km)
  return (radiusKm / 111) * 1.1;
}

// ---------- agent ----------

const acledAgent = {
  id:          'acled',
  ttlMs:       _SYNC_INTERVAL,
  countries:   DEFAULT_COUNTRIES,
  sinceYears:  2,

  async resolve(event, bus) {
    if (event.registered) {
      const db  = getDb();
      if (!_initialised) {
        initSchema(db);
        _initialised = true;
      }

      const key   = process.env.ACLED_KEY;
      const email = process.env.ACLED_EMAIL;

      if (!key || !email) {
        console.warn('[acled] ACLED_KEY / ACLED_EMAIL not set — agent will serve empty data');
        console.warn('[acled] Register at https://acleddata.com/ to get a free research API key');
      } else {
        // Initial sync: always do this on registration if we've never synced
        const lastSyncTs = getLastSyncTs(db);
        if (!lastSyncTs || Date.now() - lastSyncTs * 1000 > this.ttlMs) {
          sync(db, { key, email, countries: this.countries, sinceYears: this.sinceYears });
          // Fire and forget — don't await; serve whatever is in DB already
        }
      }

      const self = this;
      bus.install('acled', {
        events_near(lon, lat, radiusKm = 200) {
          const d = bboxDeg(radiusKm);
          const rows = db.prepare(`
            SELECT * FROM acled_events
            WHERE latitude  BETWEEN ? AND ?
              AND longitude BETWEEN ? AND ?
            ORDER BY event_date DESC
          `).all(lat - d, lat + d, lon - d, lon + d);
          // Precise haversine filter after bounding box pre-filter
          return rows.filter(r => haversine(lat, lon, r.latitude, r.longitude) <= radiusKm);
        },

        events_since(isoDate) {
          return db.prepare(`
            SELECT * FROM acled_events WHERE event_date >= ? ORDER BY event_date DESC
          `).all(isoDate);
        },

        events_in(countries = self.countries) {
          const placeholders = countries.map(() => '?').join(',');
          return db.prepare(`
            SELECT * FROM acled_events WHERE country IN (${placeholders}) ORDER BY event_date DESC
          `).all(...countries);
        },

        count() {
          return db.prepare('SELECT COUNT(*) c FROM acled_events').get()?.c ?? 0;
        },

        latest_date() {
          return db.prepare('SELECT MAX(event_date) d FROM acled_events').get()?.d ?? null;
        },

        summary() {
          return db.prepare(`
            SELECT country, event_type, COUNT(*) as count, SUM(fatalities) as fatalities
            FROM acled_events
            GROUP BY country, event_type
            ORDER BY count DESC
          `).all();
        },
      });

      const count = db.prepare('SELECT COUNT(*) c FROM acled_events').get()?.c ?? 0;
      const latest = db.prepare('SELECT MAX(event_date) d FROM acled_events').get()?.d;
      console.log(`[acled] ready: ${count} events in DB` + (latest ? `, latest: ${latest}` : ' (empty — sync in progress)'));
      return;
    }

    // Realtime mode: trigger background refresh when stale
    if (event.tick) {
      const key   = process.env.ACLED_KEY;
      const email = process.env.ACLED_EMAIL;
      if (key && email && !_syncing && Date.now() - _lastSync > this.ttlMs) {
        sync(getDb(), { key, email, countries: this.countries, sinceYears: this.sinceYears });
      }
    }
  },
};

export default acledAgent;
