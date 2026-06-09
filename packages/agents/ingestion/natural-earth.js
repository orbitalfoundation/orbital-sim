// natural-earth — country boundary GeoJSON from Natural Earth (public domain).
//
// Downloads ne_50m_admin_0_countries.geojson from the nvkelso GitHub mirror.
// 50m scale is appropriate for world-level visualization (~3 MB, clean geometry).
// No conversion needed — the file is already GeoJSON.
//
// Stored at: $ORBITAL_DATA_DIR/geo/ne_50m_countries.geojson
// TTL: 30 days (cartographic data changes very rarely)
//
// bus.geo installs:
//   .countries()       — full GeoJSON FeatureCollection
//   .country(iso3)     — single Feature by ISO 3166-1 alpha-3 code
//   .centroid(iso3)    — { lat, lon } centroid for a country (bbox center)
//   .count()           — number of country features loaded

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname }                     from 'node:path';
import { fileURLToPath }                     from 'node:url';

const _dir      = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = process.env.ORBITAL_DATA_DIR
  ?? join(_dir, '../../../public/.data');
const GEO_DIR   = join(DATA_DIR, 'geo');
const CACHE_PATH = join(GEO_DIR, 'ne_50m_countries.geojson');

const SOURCE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const TTL_MS     = 30 * 24 * 60 * 60 * 1000;

// ---------- module-level singleton ----------
let _geojson   = null;   // parsed FeatureCollection
let _byIso3    = null;   // Map<iso3, Feature>
let _syncing   = false;
let _lastSync  = 0;

// ---------- centroid (bbox midpoint — accurate enough for country markers) ----------
function bboxCentroid(feature) {
  const coords = [];
  const collect = c => {
    if (typeof c[0] === 'number') coords.push(c);
    else c.forEach(collect);
  };
  collect(feature.geometry?.coordinates ?? []);
  if (!coords.length) return null;
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  return {
    lon: (Math.min(...lons) + Math.max(...lons)) / 2,
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
  };
}

// ---------- load / sync ----------
async function load() {
  try {
    const s   = await stat(CACHE_PATH);
    const age = Date.now() - s.mtimeMs;
    if (age < TTL_MS) {
      const raw = await readFile(CACHE_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch { /* cache missing or corrupt — fetch */ }
  return null;
}

async function sync() {
  if (_syncing) return;
  _syncing = true;
  try {
    console.log(`[natural-earth] fetching ${SOURCE_URL}`);
    const res = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    await mkdir(GEO_DIR, { recursive: true });
    await writeFile(CACHE_PATH, text, 'utf8');
    const gj = JSON.parse(text);
    install(gj);
    _lastSync = Date.now();
    console.log(`[natural-earth] loaded ${gj.features?.length ?? 0} countries`);
  } catch (err) {
    console.error(`[natural-earth] sync failed: ${err.message}`);
  } finally {
    _syncing = false;
  }
}

function install(gj) {
  _geojson = gj;
  _byIso3  = new Map(
    (gj.features ?? []).map(f => [f.properties?.ISO_A3?.toUpperCase(), f])
  );
}

// ---------- agent ----------
const naturalEarthAgent = {
  id:    'natural-earth',
  ttlMs: TTL_MS,

  async resolve(event, bus) {
    if (event.registered) {
      // Load from cache; start background sync if stale or absent
      const cached = await load();
      if (cached) {
        install(cached);
        _lastSync = Date.now();
        console.log(`[natural-earth] ready: ${_geojson?.features?.length ?? 0} countries (cached)`);
      } else {
        console.log('[natural-earth] no cache — syncing…');
        sync();
      }

      bus.install('geo', {
        countries:  ()      => _geojson ?? { type: 'FeatureCollection', features: [] },
        country:    (iso3)  => _byIso3?.get(iso3?.toUpperCase()) ?? null,
        centroid:   (iso3)  => {
          const f = _byIso3?.get(iso3?.toUpperCase());
          return f ? bboxCentroid(f) : null;
        },
        count:      ()      => _geojson?.features?.length ?? 0,
      });
      return;
    }

    if (event.geo_query) {
      const q = event.geo_query;
      if (!bus.geo) return null;
      if (q.countries)        return bus.geo.countries();
      if (q.country != null)  return bus.geo.country(q.country);
      if (q.centroid != null) return bus.geo.centroid(q.centroid);
      if (q.count)            return bus.geo.count();
      return null;
    }

    if (event.tick && !_syncing && Date.now() - _lastSync > this.ttlMs) {
      sync();
    }
  },
};

export default naturalEarthAgent;
