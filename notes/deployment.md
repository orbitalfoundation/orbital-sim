# Deployment & CI/CD

## Current setup
- **Remote host**: `party-whiskey.exe.xyz` (exe.dev VM)
- **Service**: Orbital simulation website
- **Port**: 8000 (exe.dev routes from port 8000)
- **Container**: Docker, named `orbital-sim`
- **Image**: Built locally from Dockerfile, runs `node website/server/index.js`

## Auto-deploy script

**Location**: `scripts/deploy.sh`

**What it does**:
1. Polls git for changes on `origin/main`
2. Compares last deployed commit with current remote commit
3. If different:
   - Pulls the latest code
   - Rebuilds the Docker image
   - Stops and restarts the container

**How to install on remote**:
```bash
ssh party-whiskey.exe.xyz
cd terrasim
chmod +x scripts/deploy.sh

# Add to crontab to run every minute
crontab -e
# Add: * * * * * /home/exedev/terrasim/scripts/deploy.sh >> /tmp/orbital-sim-deploy.log 2>&1
```

**Manual run**:
```bash
ssh party-whiskey.exe.xyz 'cd terrasim && ./scripts/deploy.sh'
```

**Logs**:
- Deployment output: `/tmp/orbital-sim-deploy.log`
- Build output: `/tmp/orbital-sim-build.log`

## Testing the auto-deploy
1. Make a commit and push to `origin/main`
2. Wait up to 1 minute (or manually run the deploy script)
3. The container will rebuild and restart automatically
4. Check logs to verify: `ssh party-whiskey.exe.xyz tail -f /tmp/orbital-sim-deploy.log`

## Limitations
- Polling-based, not event-driven (polls every minute, max 1 min delay)
- No health checks or rollback on build failure
- No notifications if deploy fails
- Build happens on the remote (consumes VM resources)

## Future improvements
- GitHub webhook for instant deploys
- Build health checks before restart
- Slack/email notifications
- Separate build VM to avoid blocking the service
- Persistent artifact storage
# Auto-deploy enabled: Wed Jun  3 18:44:49 PDT 2026
