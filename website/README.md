# Website

Svelte 5 + Tailwind v4 frontend (`website/client`) served by a Fastify backend
(`website/server`). Static scenario pages in `public/` take priority over the SPA.

Note the root folder will dockerize and publish this as a whole - but here we're just concerned with running and testing locally, as well as making sure all the data is loaded.

## Running

```sh
# From project root:
npm run build        # build Svelte app → dist/
npm start            # start Fastify server on :3000
```

For active development with hot-reload:

```sh
npm run dev:server   # Fastify on :3000 (watches for changes)
# in a second terminal:
npm run build:watch  # Vite dev server on :5173 (proxies /api → :3000)
```

Or both at once:

```sh
npm run dev          # concurrently: Fastify + Vite dev server
```

## Local HTTPS Testing

**One-time setup for local testing:**

1) Add 'orbital.local' to `/etc/hosts`:

```
127.0.0.1    orbital.local
```

2) Make a local cert so you can visit the site as https without triggering a warning:

```sh
brew install mkcert
mkcert -install                             # installs a local CA trusted by your browser
mkcert orbital.local                        # generates the cert pair
mv orbital.local.pem     website/server/
mv orbital.local-key.pem website/server/
```

3) Whitelist `https://orbital.local:3000` in your Web3Auth dashboard project.

Web3Auth mainnet requires a whitelisted non-localhost domain over HTTPS.
`crypto.subtle` (used internally by the SDK) is also unavailable on plain HTTP
for non-localhost origins.

The server reads `TLS_CERT` and `TLS_KEY` from `website/server/.env` — they are
already set to point at these files. When the certs are present the server starts
HTTPS automatically; without them it falls back to plain HTTP.

4) Access the app at `https://orbital.local:3000`.

## Environment variables

| File | Variable | Purpose |
|------|----------|---------|
| `website/client/.env` | `VITE_WEB3AUTH_CLIENT_ID` | Web3Auth project client ID (public, baked into bundle) |
| `website/server/.env` | `WEB3AUTH_SECRET` | Web3Auth client secret (server-side only, never sent to browser) |
| `website/server/.env` | `TLS_CERT` | Path to mkcert `.pem` cert file |
| `website/server/.env` | `TLS_KEY` | Path to mkcert `-key.pem` key file |
| `website/server/.env` | `PORT` | Server port (default: 3000) |

## Scenario data

Simulation scenarios use geographic datasets too large for the main git repo.
These are **fetched automatically on first run** — no manual preparation is
needed for a fresh deployment. Local copies are cached in `public/.data/`
(gitignored).

### How data is sourced

| Dataset | Size | Source | When fetched |
|---|---|---|---|
| GEBCO elevation raster (`global_5arcmin.i16`) | 18 MB | [orbital-data](https://github.com/orbitalfoundation/orbital-data) repo | by `fetch-data.mjs` (declared `url` + `sha256` in manifests) |
| Fragile States Index | 284 KB | orbital-data repo | by the `fsi` agent on first run |
| Natural Earth boundaries | 3 MB | nvkelso GitHub mirror | by the `natural-earth` agent |
| World cities | ~2 MB | GeoNames | by the `cities` agent |
| GDELT / UCDP / ACLED events | varies | source APIs | by their ingestion agents |

Most data agents follow a stale-while-revalidate pattern: they serve cached
data immediately and refresh in the background per their own TTL.

### Fetching declared assets

For scenario manifests that declare an asset with `url` + `sha256` (e.g. the
GEBCO raster), the fetch script downloads and verifies them:

```sh
node scripts/fetch-data.mjs          # fetch any missing declared assets
node scripts/fetch-data.mjs --list   # inventory without downloading
node scripts/fetch-data.mjs --verify # checksum existing files against manifests
```

### Regenerating the GEBCO raster (rare)

The 18 MB raster is a downsample of the full-resolution GEBCO tiles (~7 GB).
This only needs regenerating when GEBCO publishes a new yearly release:

```sh
bash scripts/fetch-gebco.sh         # download full tiles from CEDA/BODC (~3 GB zip)
node scripts/gebco-downsample.mjs   # average 20×20 blocks → 18 MB raster (~30 s)
# then update the sha256 in manifests and push the new raster to orbital-data
```

Output is a raw little-endian Int16 array, 4320×2160, north-up equirectangular,
elevation in metres. The full tile set is never needed at runtime.

### Production persistence

The production container mounts `~/orbital-sim-data` as a bind mount at
`/app/public/.data`, so fetched data survives container rebuilds. On a fresh
server the agents and `fetch-data.mjs` populate it automatically on first run;
no manual sync step is required.

## Public asset paths

| Path prefix | Served from | Notes |
|-------------|-------------|-------|
| `/_app/*` | `dist/_app/` | Vite build output (content-hashed) |
| `/assets/*` | `public/assets/` | Your static files — images, data, etc. |
| `/api/*` | Fastify routes | Server API |
| `/<area>/<project>/*` | `public/<area>/<project>/` | Scenario static files |
| `/*` (fallback) | `dist/index.html` | Svelte SPA (client-side routing) |
