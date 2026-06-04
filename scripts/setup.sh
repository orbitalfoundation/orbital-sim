#!/usr/bin/env bash
# One-time server setup for orbital-sim.
# Run this once on a fresh host after cloning the repo.
# Safe to re-run — it is idempotent.
#
# Usage:
#   bash scripts/setup.sh
#
# What it does:
#   1. Verifies prerequisites (git, docker, node)
#   2. Checks .env exists
#   3. Installs the auto-deploy cron job if not already present

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_SCRIPT="$REPO_DIR/scripts/deploy.sh"
CRON_LINE="* * * * * $DEPLOY_SCRIPT >> /tmp/orbital-sim-deploy.log 2>&1"

green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }
fail() { red "ERROR: $*"; exit 1; }

echo ""
echo "orbital-sim setup"
echo "repo: $REPO_DIR"
echo ""

# --- Prerequisites ---

for cmd in git docker node; do
  if command -v "$cmd" &>/dev/null; then
    green "  [ok] $cmd found ($(command -v "$cmd"))"
  else
    fail "$cmd not found — install it before running setup"
  fi
done

# --- .env ---

ENV_FILE="$REPO_DIR/website/server/.env"
ENV_EXAMPLE="$REPO_DIR/website/server/.env.example"

if [ -f "$ENV_FILE" ]; then
  green "  [ok] .env exists"
else
  yellow "  [!!] .env missing — copy and fill in $ENV_EXAMPLE"
  yellow "       cp $ENV_EXAMPLE $ENV_FILE"
  yellow "       (server will start on plain HTTP without TLS vars)"
fi

# --- Cron job ---

chmod +x "$DEPLOY_SCRIPT"

yellow "  [..] ensure this cron entry exists on the deployment server:"
echo  "       $CRON_LINE"

# --- Done ---

echo ""
echo "Setup complete."
echo ""
echo "Next steps if this is a fresh host:"
echo "  1. Fill in website/server/.env (see .env.example)"
echo "  2. Run a first deploy manually:"
echo "       bash $DEPLOY_SCRIPT"
echo "  3. Subsequent deploys happen automatically within 1 minute of a git push."
echo ""
echo "Logs:"
echo "  Deploy: tail -f /tmp/orbital-sim-deploy.log"
echo "  Build:  tail -f /tmp/orbital-sim-build.log"
