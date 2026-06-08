// events — read-only queries over the signals SQLite DB for the REST API.
// The DB is written by ingestion agents (gdelt, ucdp, acled, cities).
// Opens the same file path they use, read-only.

import Database  from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync }    from 'node:fs';

const _dir   = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.ORBITAL_DATA_DIR ?? join(_dir, '../..', 'public/.data');
const DB_PATH  = join(DATA_DIR, 'db/signals.db');

let _db = null;
function db() {
  if (_db) return _db;
  if (!existsSync(DB_PATH)) return null;
  _db = new Database(DB_PATH, { readonly: true });
  return _db;
}

// Return true if a table exists in the DB.
function tableExists(name) {
  const d = db();
  if (!d) return false;
  return !!d.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

// ---------- events ----------

export function queryEventsByDate(source, isoDate) {
  const d = db();
  if (!d) return [];
  try {
    if (source === 'gdelt' && tableExists('gdelt_events')) {
      const ymd = isoDate.replace(/-/g, '');
      return d.prepare(
        'SELECT * FROM gdelt_events WHERE event_date=? ORDER BY num_mentions DESC LIMIT 2000'
      ).all(ymd);
    }
    if (source === 'ucdp' && tableExists('ucdp_events')) {
      return d.prepare(
        "SELECT * FROM ucdp_events WHERE date_start<=? AND (date_end>=? OR date_end IS NULL) ORDER BY deaths_best DESC LIMIT 2000"
      ).all(isoDate, isoDate);
    }
    if (source === 'acled' && tableExists('acled_events')) {
      return d.prepare(
        'SELECT * FROM acled_events WHERE event_date=? ORDER BY fatalities DESC LIMIT 2000'
      ).all(isoDate);
    }
  } catch (err) { console.warn('[events]', err.message); }
  return [];
}

// List of dates that have events (for slider range).
export function queryAvailableDates(source) {
  const d = db();
  if (!d) return [];
  try {
    if (source === 'gdelt' && tableExists('gdelt_events')) {
      return d.prepare(
        'SELECT DISTINCT event_date d FROM gdelt_events ORDER BY d'
      ).all().map(r => {
        const s = String(r.d);
        return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
      });
    }
    if (source === 'ucdp' && tableExists('ucdp_events')) {
      return d.prepare(
        "SELECT DISTINCT substr(date_start,1,10) d FROM ucdp_events ORDER BY d"
      ).all().map(r => r.d);
    }
    if (source === 'acled' && tableExists('acled_events')) {
      return d.prepare(
        'SELECT DISTINCT event_date d FROM acled_events ORDER BY d'
      ).all().map(r => r.d);
    }
  } catch (err) { console.warn('[events]', err.message); }
  return [];
}

// ---------- cities ----------

export function queryCities(minPop = 100_000) {
  const d = db();
  if (!d || !tableExists('cities')) return [];
  try {
    return d.prepare(
      'SELECT id,name,country_code,latitude,longitude,population FROM cities WHERE population>=? ORDER BY population DESC'
    ).all(minPop);
  } catch { return []; }
}

// ---------- available sources ----------

export function availableSources() {
  const d = db();
  if (!d) return [];
  const sources = [];
  if (tableExists('gdelt_events'))  {
    const row = d.prepare('SELECT COUNT(*) c, MAX(event_date) m FROM gdelt_events').get();
    if (row?.c > 0) sources.push({ id: 'gdelt', label: 'GDELT 2.0 (real-time)', count: row.c, latest: row.m });
  }
  if (tableExists('ucdp_events')) {
    const row = d.prepare('SELECT COUNT(*) c, MAX(year) m FROM ucdp_events').get();
    if (row?.c > 0) sources.push({ id: 'ucdp', label: 'UCDP GED (historical)', count: row.c, latest: row.m });
  }
  if (tableExists('acled_events')) {
    const row = d.prepare('SELECT COUNT(*) c, MAX(event_date) m FROM acled_events').get();
    if (row?.c > 0) sources.push({ id: 'acled', label: 'ACLED (curated)', count: row.c, latest: row.m });
  }
  return sources;
}
