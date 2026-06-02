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

## Public asset paths

| Path prefix | Served from | Notes |
|-------------|-------------|-------|
| `/_app/*` | `dist/_app/` | Vite build output (content-hashed) |
| `/assets/*` | `public/assets/` | Your static files — images, data, etc. |
| `/api/*` | Fastify routes | Server API |
| `/<area>/<project>/*` | `public/<area>/<project>/` | Scenario static files |
| `/*` (fallback) | `dist/index.html` | Svelte SPA (client-side routing) |
