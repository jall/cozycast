#!/usr/bin/env bash
# Upload web source maps to Sentry, then strip them from the publish output so
# raw source isn't served. Safe to run anywhere: it no-ops without an auth
# token (local builds, forks, deploy contexts where the secret is absent).
#
# Relies on Debug IDs (Metro injects them when exporting with --source-maps),
# so no release matching is required.
set -euo pipefail

DIST_DIR="${1:-dist}"

if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "SENTRY_AUTH_TOKEN not set — skipping Sentry source map upload."
  exit 0
fi

# The org lives in Sentry's EU (de) region.
export SENTRY_URL="${SENTRY_URL:-https://de.sentry.io}"
SENTRY_ORG="${SENTRY_ORG:-jall}"
SENTRY_PROJECT="${SENTRY_PROJECT:-cozycast}"

echo "Uploading source maps to Sentry ($SENTRY_ORG/$SENTRY_PROJECT)…"
npx sentry-cli sourcemaps inject "$DIST_DIR"
npx sentry-cli sourcemaps upload --org "$SENTRY_ORG" --project "$SENTRY_PROJECT" "$DIST_DIR"

# Sentry now has the maps; don't ship them to the public CDN.
find "$DIST_DIR" -name "*.map" -delete
echo "Source maps uploaded; .map files removed from publish output."
