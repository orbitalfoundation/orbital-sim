# Deployment & CI/CD

## Infrastructure

- **Remote host**: `party-whiskey.exe.xyz` (exe.dev VM)
- **Port**: 8000 (exe.dev routes externally from port 8000 → container port 3000)
- **Container**: Docker, named `orbital-sim`
- **Auto-deploy**: cron job polls git every minute, rebuilds on changes

## Standing up a new server

```bash
# 1. Clone and run setup (checks prereqs, prints cron line to add)
git clone https://github.com/anselm/terrasim.git
cd terrasim
bash scripts/setup.sh

# 2. Fill in secrets
cp website/server/.env.example website/server/.env
# edit .env: WEB3AUTH_SECRET, TLS_CERT, TLS_KEY

# 3. Install the cron job (printed by setup.sh)
crontab -e
# * * * * * /home/exedev/terrasim/scripts/deploy.sh >> /tmp/orbital-sim-deploy.log 2>&1

# 4. Sync large data files from your local machine (run this LOCALLY, not on server)
bash scripts/sync-data.sh

# 5. First deploy
bash scripts/deploy.sh
```

## Data persistence

Large elevation and scenario data (`public/.data/`) is excluded from both
git and the Docker image. It lives in a bind-mounted directory outside the
repo so it survives container rebuilds.

**Host path on server**: `~/orbital-sim-data` (sibling of the repo dir)
**Mount point in container**: `/app/public/.data`

This means:
- A `docker build` + restart never wipes the data
- Syncing data does not require a redeploy — the running container sees
  new files immediately via the bind mount

### Syncing data to a server

```bash
# From your local machine:
bash scripts/sync-data.sh                        # default server
bash scripts/sync-data.sh user@other-host        # different server
bash scripts/sync-data.sh user@host /custom/dir  # custom remote path
```

Rsync is incremental — only changed files transfer after the first run.
First run on a fresh server takes 1–2 hours (the source data is large);
subsequent runs are fast.

### If data is missing on the server

The deploy script reports data directory size at the end of each build.
An empty or missing data directory means elevation lookups and any
scenario that depends on geodata will fail silently. Run `sync-data.sh`
from your local machine to fix it.

## Logs

```bash
# Deploy / build activity
ssh party-whiskey.exe.xyz 'tail -f /tmp/orbital-sim-deploy.log'
ssh party-whiskey.exe.xyz 'tail -f /tmp/orbital-sim-build.log'

# Container output
ssh party-whiskey.exe.xyz 'docker logs -f orbital-sim'
```

## Manual operations

```bash
# Force a redeploy without waiting for cron
ssh party-whiskey.exe.xyz 'bash ~/terrasim/scripts/deploy.sh'

# Restart container without rebuilding
ssh party-whiskey.exe.xyz 'docker restart orbital-sim'

# Check container status
ssh party-whiskey.exe.xyz 'docker ps && docker stats --no-stream orbital-sim'
```

## Known limitations

- Polling-based deploy (max 1 min delay) — no GitHub webhook yet
- No health check or automatic rollback on build failure
- Build happens on the remote VM, consuming its resources during deploy
- Data sync is manual — no automation when local data changes
- TLS certs are mkcert self-signed locally; production should use Let's Encrypt
