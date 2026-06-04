#!/bin/bash
# Minimal auto-deploy script for orbital-sim
# Polls git for changes, rebuilds Docker image, restarts container on the exe.dev remote
# Install on remote: crontab -e, add: * * * * * /home/exedev/terrasim/scripts/deploy.sh >> /tmp/orbital-sim-deploy.log 2>&1
# Or run manually: ./scripts/deploy.sh

set -e

REPO_DIR="${1:-.}"
IMAGE_NAME="orbital-sim"
CONTAINER_NAME="orbital-sim"
DEPLOY_LOCK="/tmp/orbital-sim-deploy.lock"

cd "$REPO_DIR"

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
  LAST_COMMIT="$CURRENT_COMMIT"
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
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p 8000:3000 \
  "$IMAGE_NAME" \
  node website/server/index.js

echo "[$(date)] Deploy complete. Current commit: $REMOTE_COMMIT"
echo "$REMOTE_COMMIT" > "$LAST_COMMIT_FILE"
