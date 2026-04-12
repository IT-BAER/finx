#!/bin/bash
set -e

# FinX Self-Hosted — Auto-Update Script
# Called by services/autoUpdate.js when a new release tag is detected.
# Usage: ./scripts/update.sh <tag>
#
# Environment:
#   UPDATE_TAG  — the release tag to update to (also passed as $1)
#   FINX_USER   — OS user that owns the app (default: finx)
#   FINX_SERVICE — systemd service name (default: finx)

TAG="${1:-$UPDATE_TAG}"
if [ -z "$TAG" ]; then
  echo "ERROR: No tag specified"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAINTENANCE_FLAG="$ROOT/.maintenance"
FINX_USER="${FINX_USER:-finx}"
FINX_SERVICE="${FINX_SERVICE:-finx}"
LOG_PREFIX="[update]"

log() { echo "$LOG_PREFIX $*"; }
fail() { echo "$LOG_PREFIX ERROR: $*" >&2; rm -f "$MAINTENANCE_FLAG"; exit 1; }

# ── 1. Enable maintenance mode ──────────────────────────────────────────────
log "Enabling maintenance mode..."
echo "$TAG" > "$MAINTENANCE_FLAG"
sleep 2

# ── 2. Fetch and checkout the release tag ────────────────────────────────────
log "Fetching tags from origin..."
cd "$ROOT"

git fetch --tags --force 2>&1 || fail "git fetch failed"

log "Cleaning working tree..."
git stash --include-untracked 2>&1 || true
git checkout -- . 2>&1 || true

log "Checking out tag $TAG..."
git reset --hard "$TAG" 2>&1 || fail "git reset --hard $TAG failed"

# ── 3. Install backend dependencies ─────────────────────────────────────────
log "Installing backend dependencies..."
npm ci --omit=dev 2>&1 || npm install --omit=dev 2>&1 || fail "npm install failed"

# ── 4. Build frontend ───────────────────────────────────────────────────────
if [ -d "$ROOT/frontend" ]; then
  log "Installing frontend dependencies..."
  cd "$ROOT/frontend"
  npm ci 2>&1 || npm install 2>&1 || fail "Frontend npm install failed"

  log "Building frontend..."
  npm run build 2>&1 || fail "Frontend build failed"
  cd "$ROOT"
fi

# ── 5. Fix ownership ────────────────────────────────────────────────────────
if id "$FINX_USER" &>/dev/null; then
  log "Fixing file ownership to $FINX_USER..."
  chown -R "$FINX_USER:$FINX_USER" "$ROOT"
fi

# ── 6. Remove maintenance flag ──────────────────────────────────────────────
log "Removing maintenance flag..."
rm -f "$MAINTENANCE_FLAG"

# ── 7. Restart via systemd ──────────────────────────────────────────────────
log "Restarting $FINX_SERVICE via systemd..."
systemctl restart "$FINX_SERVICE" 2>&1 || fail "systemctl restart failed"

log "Update to $TAG completed successfully!"
