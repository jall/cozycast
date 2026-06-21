#!/usr/bin/env bash
# Upload web source maps to Sentry, then strip them from the publish output so
# raw source isn't served. Safe to run anywhere: it no-ops without an auth
# token (local builds, forks, deploy contexts where the secret is absent).
#
# Maps resolve via Debug IDs (Metro injects them when exporting with
# --source-maps), so they work regardless of release. When a git commit is
# available (Netlify's COMMIT_REF), we also create a Sentry release and
# associate commits, which unlocks regression tracking and suspect commits.
set -euo pipefail

DIST_DIR="${1:-dist}"

if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "SENTRY_AUTH_TOKEN not set — skipping Sentry source map upload."
  exit 0
fi

# The org lives in Sentry's EU (de) region.
export SENTRY_URL="${SENTRY_URL:-https://de.sentry.io}"
export SENTRY_ORG="${SENTRY_ORG:-jall}"
export SENTRY_PROJECT="${SENTRY_PROJECT:-cozycast}"

# Release = the deployed git commit. Netlify exposes COMMIT_REF.
RELEASE="${SENTRY_RELEASE:-${COMMIT_REF:-}}"

npx sentry-cli sourcemaps inject "$DIST_DIR"

if [ -n "$RELEASE" ]; then
  echo "Uploading source maps to Sentry for release $RELEASE…"
  npx sentry-cli releases new "$RELEASE"
  npx sentry-cli sourcemaps upload --release "$RELEASE" "$DIST_DIR"
  # Associate commits (needs the GitHub integration); don't fail the build if
  # Sentry can't resolve the range yet.
  npx sentry-cli releases set-commits "$RELEASE" --auto || echo "set-commits --auto skipped"
  npx sentry-cli releases finalize "$RELEASE"
else
  echo "No COMMIT_REF — uploading source maps without a release…"
  npx sentry-cli sourcemaps upload "$DIST_DIR"
fi

# Sentry now has the maps; don't ship them to the public CDN.
find "$DIST_DIR" -name "*.map" -delete
echo "Source maps uploaded; .map files removed from publish output."
