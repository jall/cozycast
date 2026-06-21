# cozycast

Private audio sharing for close friends — record or upload short audio "casts"
and share each one with the **specific people you choose**. No public feed, no
auto-broadcast: the interviewee controls who receives a recording.

## Sharing model (the core idea)

A cast is visible only to its **creator**, its **sharer** (the one person made
responsible for distributing it), the **participants** tagged on it, and the
explicit **recipients** it's been shared with. Friends/invites are just your
*address book* of who you *can* share with — connecting via an invite does **not**
grant access to anyone's casts.

This is enforced in Postgres (see `supabase/migrations/`): `cast_participants`
and `cast_recipients` tables, with RLS driven by the `can_access_cast` /
`can_manage_cast` `SECURITY DEFINER` helpers (security-definer so cross-table
policies don't recurse). Storage reads follow the same rule via
`can_access_audio`. Manual summaries ship now; AI summaries/cover art are a
planned fast-follow behind a Supabase Edge Function (cover art is currently
derived deterministically from the cast id in `components/CastCover.js`).

## Stack & layout

- `app/` — Expo (SDK 52) React Native app; runs on iOS, Android, and web
  (react-native-web). **Web is the primary target right now**, deployed to
  Netlify (cozycast.jall.me / cozycast.netlify.app).
- `supabase/` — Postgres schema (`migrations/`) + `config.toml`. Auth, database,
  and storage are all Supabase; there is no custom backend server.
- App entry point is `node_modules/expo/AppEntry.js`, which registers
  `app/App.js` (set via `"main"` in `app/package.json`).

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

Run lint, format:check, and test before pushing — they're the bar for "green".

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

## Web gotchas

- React Native's `Alert` is a **no-op on web**. Use `showAlert` from
  `app/src/utils/alert.js` (it falls back to the browser's native dialogs), or an
  inline message — never `Alert.alert` for anything a web user needs to see.
- Keep every `expo-*` package on the version for the installed SDK (run
  `npx expo install --check`). Mismatched native modules crash the web build at
  runtime with "Module implementation must be a class".

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
  before they can log in.

## Test account (pre-v1 only — remove before launch)

For poking at the deployed web app without going through email confirmation:

- Email: `test@cozycast.app`
- Password: `cozytest1234`

This is a pre-confirmed account seeded directly into `auth.users`. Delete it (and
this section) before go-live. Tracked in the pre-v1 cleanup issue.
