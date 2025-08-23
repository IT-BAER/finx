#!/bin/sh
# Conservative check to catch controller/route calls that invoke model.delete(...) or model.update(...)
# without using owner-scoped variants like deleteByUser / updateByUser.
#
# This is intentionally conservative and may produce false positives; it's designed to help reviewers catch regressions.
#
# Usage: ./scripts/check-owner-usage.sh
set -eu

echo "Running owner-usage lint check (controllers/routes)..."

# Search only controller and route files for potential unscoped delete/update usage.
# Exclude model method definitions (models/*) and node_modules.
MATCHES=$(grep -R --line-number -E "\.(delete|update)\s*\(" controllers routes | grep -vE "deleteByUser|updateByUser|deleteGlobal|updateGlobal" || true)

if [ -n "$MATCHES" ]; then
  echo
  echo "Potential unscoped model delete/update calls found (please review):"
  echo "-----------------------------------------------------------------"
  echo "$MATCHES"
  echo "-----------------------------------------------------------------"
  echo
  echo "If these are intentional (admin/global operations or model definitions), you can ignore them."
  echo "Otherwise, consider switching to owner-scoped helpers (e.g., deleteByUser/updateByUser) or add explicit user_id checks."
  exit 1
fi

echo "Owner-usage lint check passed: no obvious unscoped delete/update calls found in controllers/routes."
exit 0
