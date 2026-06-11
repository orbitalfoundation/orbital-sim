#!/usr/bin/env bash
# Push local elevation/scenario data to a remote server.
# Run this once on a fresh server before the first deploy, or any time
# local data has been updated and needs to be propagated.
#
# The remote destination must match DATA_DIR in deploy.sh:
#   $(dirname $REPO_DIR)/orbital-sim-data
# On the default server that is: /home/exedev/orbital-sim-data
#
# Usage:
#   bash scripts/sync-data.sh                          # default server
#   bash scripts/sync-data.sh user@other-host          # different server
#   bash scripts/sync-data.sh user@host /custom/path   # custom remote path

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DATA="$REPO_DIR/public/.data"

REMOTE_HOST="${1:-orbital-sim.exe.xyz}"
REMOTE_DIR="${2:-~/orbital-sim-data}"

if [ ! -d "$LOCAL_DATA" ]; then
  echo "No local data found at $LOCAL_DATA"
  echo "Run the fetch script first: node scripts/fetch-data.mjs"
  exit 1
fi

echo "Syncing $LOCAL_DATA → $REMOTE_HOST:$REMOTE_DIR"
echo "(this may take a while on first run)"
echo ""

rsync -az --progress --delete \
  "$LOCAL_DATA/" \
  "$REMOTE_HOST:$REMOTE_DIR/"

echo ""
echo "Sync complete. The running container will serve the updated data immediately."
echo "No redeploy needed — the data directory is a bind mount."
