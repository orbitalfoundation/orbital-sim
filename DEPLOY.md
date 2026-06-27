# Deploying Orbital

Orbital is a standard Node.js + Docker application, so it can run anywhere that
runs a container — a VM, a managed container host, or your laptop.

> **This document describes *one* concrete setup — a Docker container on a small
> Linux VM with cron-based auto-deploy — as a worked example. It is not the only
> way to deploy Orbital.** Any host that can run the Docker image (or just Node
> 24+) will work; adapt the steps below to your environment.
>
> The reference instance we run is a Docker container on an [exe.dev](https://exe.dev)
> VM at `orbital-sim.exe.xyz`. Wherever you see that hostname below, substitute
> your own host.

## Requirements

- **Node 24+** — the server uses the built-in `node:sqlite` module (added in Node
  22.5, available without a flag in Node 24). The Docker image is based on
  `node:24-bullseye`.
- **Docker** — for the containerized deployment.
- An **SSH-reachable host** — only for the remote / auto-deploy flow.

There are no native build dependencies: data agents use `node:sqlite`, so there
is nothing to compile on install.

## Option A — run locally (no Docker)

```sh
npm install
npm run build      # builds viz + the Svelte client
npm run start      # node --env-file=website/server/.env website/server/index.js
```

See [website/README.md](website/README.md) for full setup including local HTTPS
(required for Web3Auth sign-in). Large reference data is fetched automatically on
first run; see [README.md § Scenario data](README.md).

## Option B — Docker (single container)

```sh
docker build -t orbital-sim .
docker run -d --name orbital-sim \
  --restart unless-stopped \
  -p 8000:3000 \
  -v "$HOME/orbital-sim-data:/app/public/.data" \
  orbital-sim
```

- The container listens on **3000**; the example maps host **8000 → 3000**
  (exe.dev routes external traffic to port 8000). Map whatever your host expects.
- `-v …/orbital-sim-data:/app/public/.data` bind-mounts the data directory — see
  below.

### Data persistence (bind mount)

Large elevation and scenario data (`public/.data/`) is excluded from both git and
the Docker image. It lives in a bind-mounted directory **outside** the repo so it
survives image rebuilds and container restarts.

- Host path (example): `~/orbital-sim-data` (a sibling of the repo dir)
- Mount point in container: `/app/public/.data`

Because it is a bind mount, syncing new data does **not** require a redeploy — the
running container sees new files immediately.

Populate it from your local machine (rsync, incremental; first run can take
1–2 hours because the source data is large):

```sh
bash scripts/sync-data.sh                          # default example host
bash scripts/sync-data.sh user@your-host           # different host
bash scripts/sync-data.sh user@your-host /custom/path
```

If the data directory is empty, elevation lookups and any geodata-dependent
scenario fail silently — `deploy.sh` prints the data directory size at the end of
each build so this is easy to spot.

## Option C — auto-deploy on a remote host (the reference setup)

This is what `scripts/deploy.sh` and `scripts/setup.sh` automate: a cron job polls
git once a minute, and on a new commit it pulls, rebuilds the image, and restarts
the container.

```sh
# On the host, once:
git clone https://github.com/orbitalfoundation/orbital-sim.git
cd orbital-sim
bash scripts/setup.sh                 # checks prereqs, prints the cron line to add

# Fill in secrets:
cp website/server/.env.example website/server/.env
# edit .env: WEB3AUTH_SECRET, TLS_CERT, TLS_KEY

# Install the cron job (path printed by setup.sh):
crontab -e
# * * * * * /path/to/orbital-sim/scripts/deploy.sh >> /tmp/orbital-sim-deploy.log 2>&1

# From your LOCAL machine, seed the data:
bash scripts/sync-data.sh user@your-host

# First deploy (on the host):
bash scripts/deploy.sh
```

### Logs and manual operations

```sh
# Deploy / build activity
ssh your-host 'tail -f /tmp/orbital-sim-deploy.log'
ssh your-host 'tail -f /tmp/orbital-sim-build.log'

# Container output
ssh your-host 'docker logs -f orbital-sim'

# Force a redeploy without waiting for cron
ssh your-host 'bash /path/to/orbital-sim/scripts/deploy.sh'

# Restart without rebuilding
ssh your-host 'docker restart orbital-sim'

# Status
ssh your-host 'docker ps && docker stats --no-stream orbital-sim'
```

## TLS

For local development, `website/README.md` covers `mkcert`, which installs a local
CA into your system trust store so the browser accepts the cert without warnings.
The local CA only exists on machines where you've run `mkcert -install`, so it
can't impersonate anything elsewhere. **For production, use a real certificate
(Let's Encrypt, etc.).**

## Known limitations of the reference setup

- Polling-based deploy (up to ~1 min delay); no GitHub webhook.
- No health check or automatic rollback on build failure.
- The build runs on the remote VM, consuming its resources during deploy.
- Data sync is manual — there is no automation when local data changes.
- The reference TLS certs are `mkcert`-local; production needs a real CA.

---

For the original deployment notes and rationale, see the (private) `orbital-thinking`
repo, `development/20260604-docker-deployment-notes.md`.
