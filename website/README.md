# Website

Svelte 5 + Tailwind v4 frontend (`website/client`) served by a Fastify backend
(`website/server`). Static scenario pages in `public/` take priority over the SPA.

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

## Local HTTPS (required for Web3Auth sign-in)

Web3Auth mainnet requires a whitelisted non-localhost domain over HTTPS.
`crypto.subtle` (used internally by the SDK) is also unavailable on plain HTTP
for non-localhost origins.

**One-time setup:**

```sh
brew install mkcert
mkcert -install                             # installs a local CA trusted by your browser
mkcert orbital.local                        # generates the cert pair
mv orbital.local.pem     website/server/
mv orbital.local-key.pem website/server/
```

Add to `/etc/hosts`:

```
127.0.0.1    orbital.local
```

Whitelist `https://orbital.local:3000` in your Web3Auth dashboard project.

The server reads `TLS_CERT` and `TLS_KEY` from `website/server/.env` — they are
already set to point at these files. When the certs are present the server starts
HTTPS automatically; without them it falls back to plain HTTP.

Access the app at `https://orbital.local:3000`.

## Environment variables

| File | Variable | Purpose |
|------|----------|---------|
| `website/client/.env` | `VITE_WEB3AUTH_CLIENT_ID` | Web3Auth project client ID (public, baked into bundle) |
| `website/server/.env` | `WEB3AUTH_SECRET` | Web3Auth client secret (server-side only, never sent to browser) |
| `website/server/.env` | `TLS_CERT` | Path to mkcert `.pem` cert file |
| `website/server/.env` | `TLS_KEY` | Path to mkcert `-key.pem` key file |
| `website/server/.env` | `PORT` | Server port (default: 3000) |

## Scenario data

Simulation scenarios require large geographic datasets that are too big for git
and are not included in the repository. They live in `public/.data/` (gitignored).

### What's needed

| File / directory | Size | Used by |
|---|---|---|
| `public/.data/elevation/global_5arcmin.i16` | 18 MB | All current scenarios — land/sea mask and elevation at 5 arc-minute resolution |
| `public/.data/gebco_2026/` | 7 GB | High-resolution scenarios only (15 arc-second GeoTIFF tiles, source for the above) |

### Where the 18 MB raster comes from

The file `global_5arcmin.i16` is not a raw download — it is generated from the
full-resolution GEBCO 2026 tiles by averaging 20×20 pixel blocks (15 arc-sec →
5 arc-min). The pipeline is:

**Step 1 — download the GEBCO 2026 tiles** (7 GB total, 8 tiles covering 90°×90° quadrants each).

Direct download links are available at:
https://www.gebco.net/data-products/gridded-bathymetry-data

Download the GeoTIFF sub-ice topography tiles and place them in
`public/.data/gebco_2026/`. The filenames follow the pattern
`gebco_2026_n{N}_s{S}_w{W}_e{E}_geotiff.tif`.

**Step 2 — run the downsampler:**

```sh
node scripts/gebco-downsample.mjs
# reads:  public/.data/gebco_2026/*.tif
# writes: public/.data/elevation/global_5arcmin.i16  (~18 MB, ~30 s)
```

The output is a raw little-endian Int16 array, 4320×2160, north-up
equirectangular, elevation in metres. This is what all current scenarios use.
The full 7 GB tile set is only needed if you want full 15 arc-second resolution
(future high-precision scenarios) — it is not required for IPCC or the current
insolation baseline.

### Populating locally (other assets)

For assets declared in a manifest with a `url` and `sha256`, the fetch script
handles them automatically:

```sh
node scripts/fetch-data.mjs          # fetch all declared assets
node scripts/fetch-data.mjs --list   # inventory without downloading
node scripts/fetch-data.mjs --verify # checksum existing files against manifests
```

The GEBCO raster is a local-path-only reference (no `url` in the manifest) so
this script will flag it as present or missing but cannot download it — follow
the two-step process above instead.

### Pushing data to the remote server

The production container mounts `~/orbital-sim-data` as a bind mount at
`/app/public/.data`. Data is not baked into the Docker image — it must be
synced separately.

Run this **from your local machine** (not on the server):

```sh
bash scripts/sync-data.sh                        # push to default server (party-whiskey.exe.xyz)
bash scripts/sync-data.sh user@other-host        # push to a different server
bash scripts/sync-data.sh user@host /custom/dir  # custom remote data path
```

rsync is incremental — only changed files transfer after the first run.
The first sync of the full dataset (including the 7 GB tile set if present)
can take 1–2 hours. The 18 MB raster alone syncs in seconds.

No container restart is needed after a sync — the bind mount is live.

### Verifying data on the server

The deploy script reports the data directory size at the end of each build:

```
[...] Data directory: /home/exedev/orbital-sim-data (4.2G)
```

A warning instead of a size means the directory is empty or missing — run
`sync-data.sh` from your local machine to fix it.

## Public asset paths

| Path prefix | Served from | Notes |
|-------------|-------------|-------|
| `/_app/*` | `dist/_app/` | Vite build output (content-hashed) |
| `/assets/*` | `public/assets/` | Your static files — images, data, etc. |
| `/api/*` | Fastify routes | Server API |
| `/<area>/<project>/*` | `public/<area>/<project>/` | Scenario static files |
| `/*` (fallback) | `dist/index.html` | Svelte SPA (client-side routing) |
