#!/bin/bash
# Minimal auto-deploy script for orbital-sim
# Polls git for changes, rebuilds Docker image, restarts container on the exe.dev remote
# Install on remote: crontab -e, add: * * * * * /home/exedev/terrasim/scripts/deploy.sh >> /tmp/orbital-sim-deploy.log 2>&1
# Or run manually: ./scripts/deploy.sh

set -e

REPO_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
IMAGE_NAME="orbital-sim"
CONTAINER_NAME="orbital-sim"
DEPLOY_LOCK="/tmp/orbital-sim-deploy.lock"

# Data directory — lives outside the repo so it survives git operations and
# container rebuilds. Populated once via scripts/sync-data.sh.
DATA_DIR="$(dirname "$REPO_DIR")/orbital-sim-data"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$REPO_DIR" || exit 1

# Prevent concurrent deployments
if [ -f "$DEPLOY_LOCK" ]; then
  echo "[$(date)] Deploy already in progress, skipping"
  exit 0
fi
touch "$DEPLOY_LOCK"
trap "rm -f $DEPLOY_LOCK" EXIT

# Track the last commit we built
LAST_COMMIT_FILE=".last-deployed-commit"
CURRENT_COMMIT=$(git rev-parse HEAD)

# Fetch latest changes
git fetch origin main 2>/dev/null || true
REMOTE_COMMIT=$(git rev-parse origin/main 2>/dev/null || echo "$CURRENT_COMMIT")

if [ -f "$LAST_COMMIT_FILE" ]; then
  LAST_COMMIT=$(cat "$LAST_COMMIT_FILE")
else
  LAST_COMMIT="none"
fi

if [ "$REMOTE_COMMIT" = "$LAST_COMMIT" ]; then
  echo "[$(date)] No changes detected (current: $CURRENT_COMMIT, last: $LAST_COMMIT)"
  exit 0
fi

echo "[$(date)] Changes detected. Pulling and rebuilding..."
git pull origin main

echo "[$(date)] Building Docker image..."
docker build -t "$IMAGE_NAME" . > /tmp/orbital-sim-build.log 2>&1

echo "[$(date)] Restarting container..."
mkdir -p "$DATA_DIR"
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p 8000:3000 \
  -v "$DATA_DIR:/app/public/.data" \
  "$IMAGE_NAME" \
  node website/server/index.js

echo "[$(date)] Deploy complete. Current commit: $REMOTE_COMMIT"
echo "$REMOTE_COMMIT" > "$LAST_COMMIT_FILE"

# Report data directory status so it's obvious if a sync is needed.
if [ -d "$DATA_DIR" ] && [ -n "$(ls -A "$DATA_DIR" 2>/dev/null)" ]; then
  DATA_SIZE=$(du -sh "$DATA_DIR" 2>/dev/null | cut -f1)
  echo "[$(date)] Data directory: $DATA_DIR ($DATA_SIZE)"
else
  echo "[$(date)] WARNING: data directory is empty or missing: $DATA_DIR"
  echo "[$(date)]          Run from your local machine: bash scripts/sync-data.sh"
fi
