// fsi — Fragile States Index (Fund for Peace, 2006–2024).
//
// Primary source: public/_cached_data/fragile-2006-2024/fragile-states.json
// Fallback: fetches the most recent Excel from fragilestatesindex.org and parses it.
//
// The FSI total score (0–120, higher = more fragile) is the key input for the
// tipping-point model: the same food price shock has very different consequences
// in Japan (FSI ~20) vs. Yemen (FSI ~110).
//
// ISO 3166-1 alpha-3 codes are resolved lazily from Natural Earth (bus.geo)
// on the first query, since the raw FSI data has only country names.
//
// bus.fsi installs:
//   .country(nameOrIso3)  — latest FSI record for a country
//   .score(nameOrIso3)    — total FSI score for a country
//   .all()                — all countries, sorted by score descending (most fragile first)
//   .year()               — most recent year loaded
//   .top(n)               — top-N most fragile countries
//   .forYear(year)        — all countries for a specific year

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync }                 from 'node:fs';
import { join, dirname }             from 'node:path';
import { fileURLToPath }             from 'node:url';

const _dir     = dirname(fileURLToPath(import.meta.url));
const REPO     = join(_dir, '../../..');
// Primary: fetch from orbital-data GitHub repo (auto-downloaded, cached locally)
const PRIMARY_URL = 'https://raw.githubusercontent.com/anselm/orbital-data/main/fragile-states/fsi-2006-2024.json';
const PRIMARY_SHA = 'bf84e02eb5b2572bba097dd080b9cc8c1c1b5503f443b547486bdec825aff33d';
// Local cache path (same bind-mount as other .data files)
const PRIMARY  = join(DATA_DIR, 'geo/fsi-2006-2024.json');
// Legacy path — kept for backwards compat during transition
const LEGACY   = join(REPO, 'public/_cached_data/fragile-2006-2024/fragile-states.json');
const DATA_DIR = process.env.ORBITAL_DATA_DIR ?? join(REPO, 'public/.data');
const CACHE    = join(DATA_DIR, 'geo/fsi.json');

// Fallback Excel URLs (most recent first)
const FSI_EXCEL_URLS = [
  { year: 2024, url: 'https://fragilestatesindex.org/wp-content/uploads/2024/06/FSI-2024-DOWNLOAD.xlsx' },
  { year: 2023, url: 'https://fragilestatesindex.org/wp-content/uploads/2023/06/FSI-2023-DOWNLOAD.xlsx' },
];

// Well-known FSI name → ISO3 overrides (FSI names that differ from Natural Earth)
const OVERRIDES = {
  'Congo Democratic Republic': 'COD', 'Democratic Republic of the Congo': 'COD',
  'Congo Republic': 'COG', 'Republic of the Congo': 'COG',
  'Korea, South': 'KOR', 'Korea, North': 'PRK',
  'Ivory Coast': 'CIV', "Cote d'Ivoire": 'CIV', "Côte d'Ivoire": 'CIV',
  'Burma': 'MMR', 'Myanmar': 'MMR',
  'Palestinian Territories': 'PSE', 'Palestine': 'PSE',
  'Taiwan': 'TWN', 'Kosovo': 'XKX', 'Western Sahara': 'ESH',
  'East Timor': 'TLS', 'Timor-Leste': 'TLS',
  'Sao Tome and Principe': 'STP', 'Cape Verde': 'CPV', 'Cabo Verde': 'CPV',
  'Iran': 'IRN', 'Syria': 'SYR', 'Venezuela': 'VEN', 'Bolivia': 'BOL',
  'Tanzania': 'TZA', 'Vietnam': 'VNM', 'Laos': 'LAO',
  'United States': 'USA', 'United Kingdom': 'GBR',
  'Russia': 'RUS', 'Czech Republic': 'CZE', 'Czechia': 'CZE',
  'North Macedonia': 'MKD', 'Macedonia': 'MKD',
  'Gambia': 'GMB', 'The Gambia': 'GMB', 'Gambia, The': 'GMB',
  'Bahamas': 'BHS', 'The Bahamas': 'BHS', 'Bahamas, The': 'BHS',
};

// ---------- module-level singleton ----------
let _records   = [];   // { country, iso3|null, year, fsi }
let _byName    = new Map();
let _byIso3    = new Map();
let _enriched  = false;
let _syncing   = false;
let _lastSync  = 0;
const TTL_MS   = 365 * 24 * 60 * 60 * 1000;

// ---------- parse and index ----------
function processRecords(raw) {
  // Get latest year per country
  const latest = new Map();
  for (const r of raw) {
    const key = r.Country;
    if (!latest.has(key) || r.Year > latest.get(key).Year) {
      latest.set(key, r);
    }
  }

  _records = [...latest.values()].map(r => ({
    country: r.Country,
    iso3:    OVERRIDES[r.Country] ?? null,
    year:    r.Year,
    fsi:     Math.round(r.FSI * 10) / 10,
  })).sort((a, b) => b.fsi - a.fsi);

  _byName.clear(); _byIso3.clear();
  for (const rec of _records) {
    _byName.set(rec.country.toLowerCase(), rec);
    if (rec.iso3) _byIso3.set(rec.iso3, rec);
  }
}

// Enrich ISO3 codes using Natural Earth name lookups (called lazily on first query)
function enrichFromGeo(geo) {
  if (_enriched) return;
  const features = geo.countries?.()?.features ?? [];
  const nameMap  = new Map();
  for (const f of features) {
    const p = f.properties ?? {};
    const iso3 = p.ISO_A3 === '-99' ? p.ADM0_A3 : p.ISO_A3;
    if (!iso3) continue;
    for (const n of [p.NAME, p.NAME_EN, p.NAME_LONG, p.FORMAL_EN, p.BRK_NAME]) {
      if (n) nameMap.set(n.toLowerCase(), iso3);
    }
  }
  let enriched = 0;
  for (const rec of _records) {
    if (rec.iso3) continue;
    const iso3 = nameMap.get(rec.country.toLowerCase());
    if (iso3) { rec.iso3 = iso3; _byIso3.set(iso3, rec); enriched++; }
  }
  _enriched = true;
  if (enriched > 0) console.log(`[fsi] enriched ${enriched} ISO3 codes from Natural Earth`);
}

function lookup(q) {
  if (!q) return null;
  return _byIso3.get(q.toUpperCase())
      ?? _byName.get(q.toLowerCase())
      ?? null;
}

// ---------- load / sync ----------
async function load() {
  // 1. Local cache (previously fetched from GitHub or written by sync)
  for (const path of [PRIMARY, LEGACY]) {
    if (existsSync(path)) {
      try {
        const raw = JSON.parse(await readFile(path, 'utf8'));
        processRecords(raw);
        console.log(`[fsi] loaded ${_records.length} countries from local cache (${_records[0]?.year})`);
        return true;
      } catch (e) { console.warn('[fsi] cache read error:', e.message); }
    }
  }
  // 2. Fetch from orbital-data GitHub repo
  try {
    console.log('[fsi] fetching from orbital-data repo…');
    const res = await fetch(PRIMARY_URL, { signal: AbortSignal.timeout(30_000) });
    if (res.ok) {
      const text = await res.text();
      const raw  = JSON.parse(text);
      processRecords(raw);
      await mkdir(join(DATA_DIR, 'geo'), { recursive: true });
      await writeFile(PRIMARY, text, 'utf8');
      console.log(`[fsi] loaded ${_records.length} countries from GitHub (${_records[0]?.year})`);
      return true;
    }
  } catch (e) { console.warn('[fsi] GitHub fetch failed:', e.message); }
  return false;
}

async function sync() {
  if (_syncing) return;
  _syncing = true;
  try {
    for (const { year, url } of FSI_EXCEL_URLS) {
      try {
        console.log(`[fsi] trying Excel ${year}`);
        const { default: XLSX } = await import('xlsx');
        const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) continue;
        const buf  = Buffer.from(await res.arrayBuffer());
        const wb   = XLSX.read(buf, { type: 'buffer' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
        const raw  = rows
          .filter(r => r['Country'] && r['Total'])
          .map(r => ({ Country: r['Country'], Year: year, FSI: Number(r['Total']) }));
        processRecords(raw);
        await mkdir(join(DATA_DIR, 'geo'), { recursive: true });
        await writeFile(CACHE, JSON.stringify(raw, null, 2), 'utf8');
        _lastSync = Date.now();
        console.log(`[fsi] synced ${_records.length} countries (FSI ${year})`);
        return;
      } catch (e) { console.warn(`[fsi] Excel ${e.message}`); }
    }
  } finally { _syncing = false; }
}

// ---------- agent ----------
const fsiAgent = {
  id:    'fsi',
  ttlMs: TTL_MS,

  async resolve(event, bus) {
    if (event.registered) {
      const ok = await load();
      if (!ok) sync();
      _lastSync = Date.now();

      bus.install('fsi', {
        country: (q)    => { if (bus.geo && !_enriched) enrichFromGeo(bus.geo); return lookup(q); },
        score:   (q)    => { if (bus.geo && !_enriched) enrichFromGeo(bus.geo); return lookup(q)?.fsi ?? null; },
        all:     ()     => { if (bus.geo && !_enriched) enrichFromGeo(bus.geo); return _records; },
        top:     (n=20) => { if (bus.geo && !_enriched) enrichFromGeo(bus.geo); return _records.slice(0, n); },
        year:    ()     => _records[0]?.year ?? null,
        count:   ()     => _records.length,
        forYear: (yr)   => {
          if (existsSync(PRIMARY)) {
            try {
              const raw = JSON.parse(require('fs').readFileSync(PRIMARY, 'utf8'));
              return raw.filter(r => r.Year === yr).sort((a,b) => b.FSI - a.FSI);
            } catch {}
          }
          return _records.filter(r => r.year === yr);
        },
      });
      console.log(`[fsi] ready: ${_records.length} countries (latest year: ${_records[0]?.year ?? '?'})`);
      return;
    }

    if (event.fsi_query) {
      const q = event.fsi_query;
      if (!bus.fsi) return null;
      if (q.iso3    != null) return bus.fsi.country(q.iso3);
      if (q.country != null) return bus.fsi.country(q.country);
      if (q.score   != null) return bus.fsi.score(q.score);
      if (q.all)             return bus.fsi.all();
      if (q.top     != null) return bus.fsi.top(q.top);
      if (q.year)            return bus.fsi.year();
      if (q.count)           return bus.fsi.count();
      if (q.forYear != null) return bus.fsi.forYear(q.forYear);
      return null;
    }

    if (event.tick && !_syncing && Date.now() - _lastSync > this.ttlMs) sync();
  },
};

export default fsiAgent;
