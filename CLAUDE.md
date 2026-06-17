# cozycast

Private audio sharing for close friends — record or upload short audio "casts"
and share them with people you've connected with via invite codes.

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
- `npx expo export --platform web` — production web build (what Netlify runs) → `dist/`
- `npx expo install --check` — verify dependency versions match the installed SDK
- `npm run lint` — ESLint (`eslint-config-expo` + Prettier compatibility). `npm run lint:fix` to autofix.
- `npm run format` — Prettier write. `npm run format:check` to verify only.
- `npm test` — Jest (`jest-expo` preset) + React Native Testing Library. `npm run test:watch` for watch mode.

Run lint, format:check, and test before pushing — they're the bar for "green".

## Dev workflow

**Pre-v1 (now): commit directly to `main`.** No PRs or review required until v1
ships and we have real users — we're iterating fast. Once v1 lands, switch back
to feature branches + PRs + CI.

## Configuration (12-factor)

- Config lives in the **environment, not the repo**. Read it from
  `EXPO_PUBLIC_*` vars (`EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SITE_URL`,
  `EXPO_PUBLIC_SENTRY_DSN`). `EXPO_PUBLIC_*` vars are inlined at build time, so
  they must be set in the Netlify **build** environment (and a local `.env` for
  dev).
- Don't add new hardcoded credentials/URLs. The Supabase URL/anon-key still have
  baked-in fallbacks from early scaffolding — that's a known deviation tracked in
  the pre-v1 cleanup issue, not a pattern to copy.

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
  hardcoded. Without it, Sentry stays off. Source-map upload (needs a secret
  `SENTRY_AUTH_TOKEN`) is not set up yet — stack traces will be minified until
  then.
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
