# cozycast

Private audio sharing for close friends — record or upload short audio "casts"
and share each one with the **specific people you choose**. No public feed, no
auto-broadcast: the interviewee controls who receives a recording.

## Sharing model (the core idea)

(Invites: a single-use code handed out as a link, `https://cozycast.jall.me/invite/CODE`.
`utils/invites` stashes the code when the page loads; `usePendingInvite`
redeems it once there's a session — straight away, or after signup/confirm/login
— and `redeem_invite` returns the inviter's name for the "connected" toast.)

**Asking for a cast:** `cast_requests` (visible to its two people only) — you
ask someone in your address book for a cast with a prompt; they answer by
recording one, which is shared with you and marks the ask answered
(`answer_cast_request`). **Profiles** are visible only to people connected to
you (`can_see_profile`: you, your address book, people on casts you can access,
and people you've asked / been asked by) — never to every signed-in user.
A cast belongs to everyone in it: its creator and anyone tagged can edit its
title/summary (`update_cast_words`) **and** choose who hears it
(`can_manage_cast` includes participants; `sharer_id` survives only as an extra
manager on older casts).

**Pass the mic** (casts made in turns): `casts.together`, with each take in
`cast_turns` (`casts.audio_path` = the first take, `casts.duration` = the sum).
`add_cast_turn` adds yours when it's your turn (`casts.turn_with`) and passes
the mic on — or, passing to nobody, finishes it; `finish_together_cast` is
"we're done" for any maker. Until `finished_at`, only its makers can hear it and
nobody can be added as a recipient (`cast_in_progress` in the recipients policy).
`can_access_audio` covers turn audio. The player plays a track's `segments`
back to back (`utils/segments`); `utils/turns` gives makers their colours and
the banded waveform (`togetherShape`).

A cast is visible only to its **creator**, its **sharer** (the one person made
responsible for distributing it), the **participants** tagged on it, and the
explicit **recipients** it's been shared with. Friends/invites are just your
_address book_ of who you _can_ share with — connecting via an invite does **not**
grant access to anyone's casts.

This is enforced in Postgres (see `supabase/migrations/`): `cast_participants`
and `cast_recipients` tables, with RLS driven by the `can_access_cast` /
`can_manage_cast` `SECURITY DEFINER` helpers (security-definer so cross-table
policies don't recurse). Storage reads follow the same rule via
`can_access_audio`. Comments (`cast_comments`) use the same helpers: anyone with
cast access can read/post; the author or a cast manager can delete.
In-app **notifications** (`notifications` table) are written by SECURITY DEFINER
triggers and are owner-only via RLS: a new comment (everyone involved in the
cast, minus the author), a cast shared with you, being tagged in a cast, being
asked to be a cast's sharer, someone first listening to a cast you made or
share (`cast_plays`, written when playback starts), being passed the mic
(`turn`), and a cast you're making together being finished (`finished`). They're about people, never
metrics. `app/notifications.js` shows them. (Push delivery is a later tranche, #15;
the table can also feed a calmer "next unread" home — the data model is the
durable part, the surface is provisional.) **Transcripts** come from the
`transcribe` Edge Function (`supabase/functions/transcribe`, deployed with the
Supabase CLI/MCP — not by the GitHub integration): the app calls it after
saving a cast or turn (and the cast page asks once for any cast missing one);
it checks access by reading the cast as the caller, then hands Groq's Whisper
(`whisper-large-v3-turbo`, ~$0.04/audio hour) a 10-minute signed URL and
writes `transcripts` (one row per audio file, `[{ s, e, t }]` segments; read
via `can_access_cast`). Needs the `GROQ_API_KEY` Edge Function secret — without
it the function quietly does nothing. The cast page shows them as a
read-along ("What was said"). Manual summaries ship now; AI summaries/cover art are a
planned fast-follow behind a Supabase Edge Function (cover art is currently
derived deterministically from the cast id in `components/CastCover.js`).

## Stack & layout

- `app/` — Expo (SDK 52) React Native app; runs on iOS, Android, and web
  (react-native-web). **Web is the primary target right now**, deployed to
  Netlify (cozycast.jall.me / cozycast.netlify.app).
- `supabase/` — Postgres schema (`migrations/`) + `config.toml`. Auth, database,
  and storage are all Supabase; there is no custom backend server.
- **Routing is Expo Router** (`"main": "expo-router/entry"`). Routes live in
  `app/app/`: `_layout.js` (the root — fonts, Sentry, providers, and the
  signed-in/out gate; signed-out renders `src/screens/PublicRoot.js`, signed-in
  renders the `<Stack>` — on a laptop wrapped in the persistent `Sidebar` rail
  and, from `layout.panelAt`, the `NowPlayingPanel`, so they stay put on every
  route), `index.js` (the tab home: Fireside/Record/You — tabs are local state
  in `ShellContext`, not routes; a slim bottom `TabBar` on phones),
  `cast/[id].js` (the shareable cast detail page; paints instantly from the
  feed's cached data), `notifications.js`, `person/[id].js` (someone's page: what's passed between you, plus "Record with them"), and `invite/[code].js` (just
  redirects home — see invites below). Reusable UI/logic stays in `app/src/`
  (`components/`, `screens/`, `context/`, `api/`). Web build is a single-page SPA
  (`web.output: "single"` in `app.json`); the `netlify.toml` `/* → /index.html`
  redirect serves deep links like `/cast/:id`. Because the URL is untouched while
  signed out, a deep link is preserved through login (the Stack mounts on it once
  a session exists).

## Commands (run from `app/`)

- `npx expo start --web` — local web dev server
- `npx expo export --platform web` — production web build → `dist/`
- `npm run build:web` — what Netlify runs: web build with source maps, then
  uploads them to Sentry and strips `.map` files from `dist/` (no-ops without
  `SENTRY_AUTH_TOKEN`)
- `npx expo install --check` — verify dependency versions match the installed SDK
- `npm run lint` — ESLint (`eslint-config-expo` + Prettier compatibility). `npm run lint:fix` to autofix.
- `npm run format` — Prettier write. `npm run format:check` to verify only.
- `npm test` — Jest (`jest-expo` preset) + React Native Testing Library. `npm run test:watch` for watch mode.
- `npm run test:e2e` — Playwright browser smoke tests against a deployed build (see "End-to-end tests" below). Separate from `check`.

Run lint, format:check, and test before pushing — they're the bar for "green".

## End-to-end tests (Playwright)

`npm run test:e2e` runs the smoke tests in `app/e2e/` against a **deployed** web
build — web is the primary target, so we exercise the real thing (landing →
manifesto → sign-in, plus a signed-in feed check). They're deliberately separate
from the Jest unit suite (Jest ignores `e2e/`), so `npm run check` stays fast and
offline; run `test:e2e` on its own.

- **Target:** defaults to `https://cozycast.jall.me`; override with `E2E_BASE_URL`
  (a Netlify deploy preview, or a local `npx expo start --web`).
- **Browser:** run `npx playwright install chromium` once locally. In
  CI/sandboxes where Chromium is pre-provisioned, set `PLAYWRIGHT_CHROMIUM_PATH`
  to the binary so nothing downloads. `playwright.config.js` disables QUIC/ECH for
  reliability behind proxies (harmless elsewhere).
- **Three tiers of signed-in coverage:**
  - _Public_ checks need no credentials and always run.
  - _Prod-safe signed-in_ tests run when `E2E_EMAIL` / `E2E_PASSWORD` are set
    (the pre-v1 test account). These never depend on pre-existing data: the
    cast-detail round-trip **records → creates → opens → deletes** its own cast,
    so it's self-cleaning and safe against prod.
  - _Fixture-dependent_ tests (`signed in (local fixtures)`) assert against the
    seeded Alice/Ben/Cleo data and run only with `E2E_FIXTURES=1` against a local
    seeded stack (see "Local fixtures" below). This is where comprehensive
    signed-in coverage should grow — deterministic data, no prod writes.
- **Selectors:** react-native-web renders `Text` as `<div>` and `TouchableOpacity`
  as a clickable `<div>`, so tests locate elements by visible text
  (case-insensitive — some headings use CSS `text-transform`). Where text isn't
  unique or stable, add a `testID` and select with `getByTestId` (e.g.
  `record-start` / `record-stop` drive the recording flow).

## Local fixtures (for comprehensive signed-in tests)

Two layers seed a full local world to test logged-in flows deterministically,
**never against prod**:

- **Relational** — `supabase/seed.sql`, applied by `supabase db reset`: users
  Alice/Ben/Cleo (`*@cozycast.test`, password `cozytest1234`), mutual
  friendships, and two shared casts with participants/recipients.
- **Storage** — `app/scripts/seed-fixtures.mjs` (`npm run fixtures`): SQL can't
  put files in storage, so this uploads a placeholder audio clip to each seeded
  cast's `audio_path` (readable via `can_access_audio`, which matches on path) so
  playback/detail actually resolve. It writes with the service-role key and so
  **hard-refuses any non-local target** (the prod project ref is blocked
  outright; non-local needs `ALLOW_REMOTE_FIXTURES=1`).

Commands (from `app/`): `npm run db:reset` (relational), `npm run fixtures`
(storage), or `npm run dev:seed` (both). Then point the app at local
(`EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` + local anon key),
`npx expo start --web`, and run `E2E_FIXTURES=1 E2E_BASE_URL=http://localhost:8081
npm run test:e2e`.

### Provisioning the local stack

`supabase start` (Docker) runs the whole stack locally. Notes from getting it
up, including in constrained/CI sandboxes:

- **CLI:** ships as a dev dependency (`supabase` in `app/package.json`), so a
  plain `npm install` provides it — the `db:reset` / `fixtures` / `dev:seed`
  scripts find it on the local `.bin`, and you can call it directly with `npx
supabase …`. The npm package is a tiny shim that fetches the platform binary
  lazily on first run (no install-time/CI download), which also sidesteps proxies
  that block GitHub release assets.
- **Unprivileged containers:** the `edge-runtime` (and some extras) can't set
  rlimits and abort the start. Bring up just what the app/tests need with
  `supabase start -x edge-runtime,studio,imgproxy,realtime,vector,logflare,supavisor,postgres-meta,mailpit`
  (leaves db, auth, rest, storage, kong). Get keys with `supabase status -o env`.
- **`EXPO_PUBLIC_*` are inlined into a _cached_ Metro transform.** After changing
  which Supabase a build points at, rebuild with `npx expo export --platform web
--clear` (or `expo start --clear`) or you'll keep hitting the old project.
- **Ephemeral sandboxes tear the stack down between idle periods** (a manually
  started `dockerd` and its containers don't persist) — it's not OOM (plenty of
  RAM, no cgroup limit), just lifecycle, so re-run the bring-up after a gap. A
  reset interrupted mid-flight can leave the `casts` bucket uncreated (uploads
  then 400 "Bucket not found"); `npm run fixtures` recreates it if missing, and
  after a `db reset`/`start` wait for all containers `healthy` before running e2e.
- The detail screen has `testID="cast-detail"`; scope detail assertions to it
  (`getByTestId('cast-detail')`) — the router keeps the feed mounted/hidden
  behind it, so unscoped text matches the feed card too.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push to `main`, on
pull requests, and on manual dispatch:

- **check** — `npm run check` (lint + format + Jest). Fast, offline; the bar for
  every change.
- **e2e** — Playwright smoke tests (`needs: check`). To avoid racing the deploy,
  it tests the Netlify deploy of _this_ commit: the web build inlines the commit
  SHA (`EXPO_PUBLIC_COMMIT_REF`), so when a fresh deploy is expected the job polls
  the deploy URL until the served bundle reports that SHA. Netlify's base dir is
  `app/`, so it only builds when `app/` changes — the job mirrors that: it waits
  only when the push touched `app/` (or it's a PR preview), and otherwise just
  tests whatever's currently live (root-only commits like docs/CI don't trigger a
  deploy). PRs target the deterministic `deploy-preview-<n>--cozycast.netlify.app`
  URL; pushes/dispatch use prod (`E2E_BASE_URL` repo variable). The signed-in +
  recording tests run only when the `E2E_EMAIL` / `E2E_PASSWORD` repo **secrets**
  are set; otherwise they skip. (CI is advisory pre-v1; not a merge gate while we
  commit directly to `main`.)

A second workflow, `keepalive.yml`, runs on its own daily schedule and is
unrelated to testing — see "Keeping the free-tier projects awake" under
**Supabase**.

## Dev workflow

**Pre-v1 (now): commit directly to `main`.** No PRs or review required until v1
ships and we have real users — we're iterating fast. Once v1 lands, switch back
to feature branches + PRs + CI.

This applies to **agents/automation too**: develop and push to `main` for pre-v1
work, even if the harness/tooling defaults you to a feature branch — prefer
`main` unless explicitly told otherwise. `main` is what Supabase (migrations via
the GitHub integration) and Netlify deploy from, so work landing there is what
actually ships.

Destructive migrations are fine pre-v1 — there's no real user data yet. Don't
hand-write data into prod; seed non-prod environments from `supabase/seed.sql`
(applied by `supabase db reset` locally), never against the production project.

**Migrations are the single source of truth for the schema.** The full database
must rebuild from `supabase/migrations/` alone (`supabase db reset` does exactly
that) — so the safety net for an off-piste change is "wipe and replay". That only
holds if every schema change lives in a migration: experimenting directly on prod
(SQL editor, MCP) is fine pre-v1, but **capture the change as a migration file
afterward**, or a wipe-and-replay will silently drop it. Apply migrations by
landing them on `main` (the Supabase GitHub integration runs them) rather than
poking prod by hand.

## Configuration (12-factor)

- Config lives in the **environment, not the repo**. Read it from
  `EXPO_PUBLIC_*` vars (`EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SITE_URL`,
  `EXPO_PUBLIC_SENTRY_DSN`). `EXPO_PUBLIC_*` vars are inlined at build time, so
  they must be set in the Netlify **build** environment (and a local `.env` for
  dev).
- Don't add hardcoded credentials/URLs. All config is env-driven: copy
  `app/.env.example` to `app/.env` for local dev; the same vars live in the
  Netlify build env. Missing Supabase vars throw a clear error at startup.
  (`EXPO_PUBLIC_SITE_URL` keeps a safe public default of `https://cozycast.jall.me`.)

## Audio (playback & casts)

- Playback/recording use `expo-av`: one app-wide sound in
  `context/PlayerContext.js` (play/seek/skip/speed, plus per-cast "where you
  left off" kept in AsyncStorage so cards show banked progress and playback
  resumes), driven by `components/PlayerDeck.js` (the waveform scrubber +
  controls, used by the cast page and the now-playing panel) and the
  `MiniPlayer`; recording in `screens/RecordScreen.js`.
- **Waveforms** are real: at create time the uploader's browser decodes the
  audio (Web Audio, resampled to 8 kHz, off the main thread) into ~200 RMS
  values, 0–100 (`utils/peaks.js`), stored in `casts.peaks`. It runs alongside
  the upload and is attached with a follow-up update, so it never delays saving
  a cast. Casts without peaks (older ones, native uploads, decode failures) fall
  back to a deterministic portrait from the cast id (`utils/waveform.js`), and
  the cast page backfills them when someone who manages the cast opens it on
  web. Seeking needs the audio host to honour HTTP range requests (Supabase
  storage does).
- **Notes along the way:** a comment can be pinned to a moment
  (`cast_comments.at_ms`). Pinned notes become dots on the scrubber and "at
  2:31" chips that jump there. The client retries without the column if a
  database hasn't got the migration yet. expo-av is deprecated in favour of `expo-audio`;
  migrating is a worthwhile future cleanup but **doesn't unlock lock-screen
  artwork** — rich now-playing controls aren't first-class there either, so it
  doesn't change the decision below.
- **Lock screen:** on web we set `navigator.mediaSession` metadata with a 512px
  cover (rendered from `utils/castCover` via `utils/castArtwork`). On native we
  only keep audio alive in the background (`staysActiveInBackground`, plus iOS
  `UIBackgroundModes: ["audio"]` in `app.json`) — full native lock-screen
  artwork/controls would need `react-native-track-player` (a dev/EAS build, no
  Expo Go); deliberately deferred until native actually ships.
- **Uploads** go straight to the storage REST endpoint so we can show progress
  (XHR on web, `expo-file-system` upload on native); the SDK is the no-progress
  fallback. The `casts` bucket only allows `audio/*`, so the picker filters out
  video up front. Duration is read from metadata at create time (web `<audio>`,
  native expo-av) so the feed shows length before playback.

## Web gotchas

- React Native's `Alert` is a **no-op on web**. For non-blocking feedback
  (success/error/info) prefer `useToast()` from `app/src/context/ToastContext.js`
  — soft, on-brand toasts. Reserve `showAlert` from `app/src/utils/alert.js` (it
  falls back to the browser's native `confirm`) for true confirmations like
  logout. Never use `Alert.alert` for anything a web user needs to see.
- Keep every `expo-*` package on the version for the installed SDK (run
  `npx expo install --check`). Mismatched native modules crash the web build at
  runtime with "Module implementation must be a class".
- **Look ("Campfire"):** night ground, cream ink, and ember as the one loud
  colour, reserved for what's alive (play, record, progress). Use the roles in
  `src/theme/colors.js`, never raw hexes; dark text (`colors.onEmber`) goes on
  ember. The campfire (`components/Campfire.js`), night sky (`NightSky`),
  covers (`CastCover`, from `utils/castCover`) and glows (`Glow`) are
  `react-native-svg`; every ambient loop holds still under reduce-motion
  (`hooks/useReducedMotion`). See `docs/design-vision.md`.
- **Typography:** three faces (`src/theme/typography.js`): Fraunces (serif) for
  titles and its italic for _moments_ (`type.moment`), Nunito for body/UI, DM
  Mono for time (`type.time`, `type.monoLabel`). Loaded once in
  `app/_layout.js` via `useFonts` (render is gated until it resolves). Set
  `fontFamily: fonts.*` — the weight is baked into the family, so don't rely on
  `fontWeight`. Import weights by subpath (e.g.
  `@expo-google-fonts/fraunces/500Medium`) so only used faces are bundled.

## Error tracking

- Sentry (`@sentry/react-native`) is initialised in `app/App.js`, gated on
  `__DEV__` so it only reports from real builds, not local dev.
- The DSN comes from `EXPO_PUBLIC_SENTRY_DSN` (set in Netlify build env) — never
  hardcoded. Without it, Sentry stays off.
- Source maps upload during the Netlify build (`app/scripts/upload-sourcemaps.sh`,
  via Debug IDs) when the secret `SENTRY_AUTH_TOKEN` is set; otherwise the step
  is skipped and traces stay minified. Org/project default to `jall`/`cozycast`
  (EU region).
- Events are tagged with a release = the deployed git commit (Netlify's
  `COMMIT_REF`, inlined at build as `EXPO_PUBLIC_COMMIT_REF` and used both at
  runtime and for the upload), enabling regressions and suspect commits.
- Don't run `@sentry/wizard`; the runtime wiring is already in place by hand.

## Supabase

- Project ref: `yhaswqvewhigrpoduhyr`
- **Auth → URL Configuration** must list the production site
  (`https://cozycast.jall.me`) as the Site URL and an allowed redirect, or the
  email confirmation links break. Signup passes `emailRedirectTo` from
  `EXPO_PUBLIC_SITE_URL` (default `https://cozycast.jall.me`).
- Email confirmation is **enabled**, so new signups must confirm via email
  before they can log in. Signing up with an **already-registered** email is
  hidden by Supabase (anti-enumeration): `signUp` "succeeds" with an empty
  `identities` array and **no email is sent** — `AuthContext.signup` detects this
  (`alreadyRegistered`) so we tell the user to log in instead of waiting forever.
- **Password reset** is in-app: "Forgot password?" → `resetPasswordForEmail`
  (redirects to the Site URL); the link returns to the web app where
  `detectSessionInUrl` (web-only, see `api/supabase.js`) consumes the token and
  fires `PASSWORD_RECOVERY`, which routes to `ResetPasswordScreen`.
- **Email delivery caveat:** the project uses Supabase's built-in SMTP, which is
  heavily rate-limited (a few/hour) and for testing only. Real
  confirmation/reset emails need a custom SMTP provider configured before launch.

### Keeping the free-tier projects awake

Free plan projects are paused after a 7-day window of too little **user
database activity**, and a paused project is only restorable for 90 days
before a downloadable backup is all that's left. `.github/workflows/keepalive.yml`
runs daily and makes three real queries so the project never gets that quiet.

- Config: `SUPABASE_URL` and `SUPABASE_ANON_KEY` under Settings → Secrets and
  variables → Actions. The URL is read as
  `vars.SUPABASE_URL || secrets.SUPABASE_URL`, so it works from either tab —
  the earlier variable-only version silently resolved to an empty string when
  it was added as a secret. The key is secret-only, so it stays masked in
  logs. Publishable (anon) key only — a keepalive needs no privileges at all,
  so never give it the service-role key.
- The ping has to genuinely reach Postgres. `/rest/v1/` (401s for anon) and
  `/auth/v1/health` (answers without a query) don't count — most of the
  keepalive templates floating around ping one of those and quietly do
  nothing while showing green. cozycast grants `anon` nothing on any table by
  design, so the ping calls `public.keepalive()`
  (`supabase/migrations/20260913120000_keepalive.sql`), a function that reads
  no data and just returns `now()`, leaving the sharing model untouched.
- **`pg_cron` can't do this job.** The heuristic counts _user_ requests, and
  in-database cron doesn't run on a project that's already paused — the
  traffic has to come from outside.
- **One workflow per repo.** This one covers cozycast only; each project repo
  carries its own copy so each owns its own liveness and nothing breaks if
  another repo is archived. There is no pre-built Marketplace action worth
  adopting — the popular ones are fork-this-template repos, and a scheduled
  job holding your keys isn't the place for a third-party dependency.
- The workflow also commits a dated marker to `.github/last-heartbeat` if the
  repo has been quiet for 50 days: GitHub disables scheduled workflows in
  public repos after 60 days of inactivity, which is exactly when this one
  matters most. The commit is tagged `[skip ci]` so it doesn't trigger CI or
  a Netlify build.
- A failed run means the project didn't answer — possibly already paused.
  GitHub emails the repo owner when a scheduled workflow fails.

## Test account (pre-v1 only — remove before launch)

For poking at the deployed web app without going through email confirmation:

- Email: `test@cozycast.app`
- Password: `cozytest1234`

This is a pre-confirmed account seeded directly into `auth.users`. Delete it (and
this section) before go-live. Tracked in the pre-v1 cleanup issue.
