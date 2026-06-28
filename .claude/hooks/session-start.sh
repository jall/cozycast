#!/bin/bash
# ============================================================================
# SessionStart hook — provision a local Supabase stack for signed-in / fixture
# e2e in Claude Code on the web. See issue #14 and CLAUDE.md ("Local fixtures").
#
# It is the automated version of the by-hand steps: start dockerd, install the
# supabase CLI (a devDependency), `supabase start` (minus the containers that
# can't set rlimits in an unprivileged sandbox), then `npm run dev:seed`. It
# also writes the local Supabase URL + anon key to the session env so a
# `--clear` web build/serve targets local.
#
# GATING — two switches, both required, so docs/CI-only sessions start instantly
# and we never touch a developer's real machine:
#   * CLAUDE_CODE_REMOTE=true   set automatically inside a web sandbox.
#   * COZYCAST_E2E_SANDBOX=1     opt-in; set it as an environment variable only
#                               on the web environment where you want e2e.
# ============================================================================
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
if [ "${COZYCAST_E2E_SANDBOX:-}" != "1" ]; then
  echo "cozycast: COZYCAST_E2E_SANDBOX != 1 — skipping local Supabase provisioning." >&2
  exit 0
fi

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
APP_DIR="$REPO_ROOT/app"
SUPABASE_BIN="$APP_DIR/node_modules/.bin/supabase"

echo "cozycast: provisioning local Supabase for signed-in e2e…" >&2

# 1. Docker daemon. The image ships the docker client but no running daemon;
#    start one (works as root). Idempotent — skipped if already up.
if ! docker info >/dev/null 2>&1; then
  echo "  starting dockerd…" >&2
  dockerd >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 60); do
    if docker info >/dev/null 2>&1; then break; fi
    sleep 1
  done
  if ! docker info >/dev/null 2>&1; then
    echo "  dockerd did not come up; see /tmp/dockerd.log" >&2
    exit 1
  fi
fi

# 2. Dependencies — `npm install` provides the supabase CLI (a devDependency,
#    a shim that lazily fetches its binary on first run). `install` (not `ci`)
#    so the cached container state speeds up later sessions.
echo "  npm install…" >&2
if ! ( cd "$APP_DIR" && npm install --no-audit --no-fund >/tmp/npm-install.log 2>&1 ); then
  echo "  npm install failed; see /tmp/npm-install.log" >&2
  exit 1
fi

# 3. Start the stack, excluding the containers that abort `supabase start` in an
#    unprivileged sandbox (they can't set rlimits). Leaves db, auth, rest,
#    storage, kong — enough for the app + tests. Idempotent if already running.
echo "  supabase start…" >&2
if ! ( cd "$REPO_ROOT" && "$SUPABASE_BIN" start \
      -x edge-runtime,studio,imgproxy,realtime,vector,logflare,supavisor,postgres-meta,mailpit \
      >/tmp/supabase-start.log 2>&1 ); then
  echo "  supabase start failed; see /tmp/supabase-start.log" >&2
  exit 1
fi

# 4. Seed relational data (db reset) + storage fixtures.
echo "  npm run dev:seed…" >&2
if ! ( cd "$APP_DIR" && npm run dev:seed >/tmp/supabase-seed.log 2>&1 ); then
  echo "  dev:seed failed; see /tmp/supabase-seed.log" >&2
  exit 1
fi

# 5. Point this session's builds/runtime at the local stack. EXPO_PUBLIC_* are
#    inlined at build time into a *cached* Metro transform, so rebuild with
#    `--clear` (e.g. `npx expo export --platform web --clear`) after this for the
#    bundle to actually hit local. The anon key is read live from the stack
#    rather than hardcoded so it can't drift across CLI versions.
ANON_KEY="$("$SUPABASE_BIN" status --workdir "$REPO_ROOT" -o env 2>/dev/null \
  | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')"
if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -n "$ANON_KEY" ]; then
  {
    echo "export EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321"
    echo "export EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
    echo "export E2E_FIXTURES=1"
  } >> "$CLAUDE_ENV_FILE"
  echo "  wrote EXPO_PUBLIC_SUPABASE_* + E2E_FIXTURES to the session env." >&2
fi

echo "cozycast: local Supabase ready. Build local with --clear, then:" >&2
echo "  cd app && E2E_FIXTURES=1 E2E_BASE_URL=http://localhost:8081 npm run test:e2e" >&2
