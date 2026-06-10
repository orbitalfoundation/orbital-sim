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

Simulation scenarios require large geographic datasets that are too big for git
and are not included in the repository. They live in `public/.data/` (gitignored).

@todo currently some of this has to be fetched by hand - plan is to automate this.

### What's needed

| File / directory | Size | Used by |
|---|---|---|
| `public/.data/elevation/global_5arcmin.i16` | 18 MB | All current scenarios — land/sea mask and elevation at 5 arc-minute resolution |
| `public/.data/elevation/global_15arcsec.i16/` | 7 GB | GeoTIFF tiles at full 15 arc-second resolution — source material for the downsampler, and available for future high-precision scenarios |

### Where the 18 MB raster comes from

The file `global_5arcmin.i16` is not a raw download — it is generated from the
full-resolution GEBCO 2026 tiles by averaging 20×20 pixel blocks (15 arc-sec →
5 arc-min). The pipeline is:

**Step 1 — download and extract the GEBCO 2026 tiles** (~3 GB zip, expands to ~7 GB):

```sh
bash scripts/fetch-gebco.sh
# downloads zip from CEDA/BODC, extracts 8 tiles to public/.data/elevation/global_15arcsec.i16/
```

Or manually: download the zip directly from
`https://dap.ceda.ac.uk/bodc/gebco/global/gebco_2026/ice_surface_elevation/geotiff/gebco_2026_geotiff.zip?download=1`
and unzip the `.tif` files into `public/.data/elevation/global_15arcsec.i16/`.

**Step 2 — run the downsampler:**

```sh
node scripts/gebco-downsample.mjs
# reads:  public/.data/elevation/global_15arcsec.i16/*.tif
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
