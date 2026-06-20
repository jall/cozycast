# cozycast

A cozy, private audio-sharing app for close friends. Record or upload short audio
"casts" and share them only with the people you've connected to via invite codes —
no public feeds, no algorithms, no strangers. Just a quiet little corner for the
people you actually care about.

cozycast is built with [Expo](https://expo.dev/) (React Native) so it runs on
iOS, Android, and the web from a single codebase, and it's backed entirely by
[Supabase](https://supabase.com/) for auth, database, and storage — there is no
custom backend server. The web build is the current primary target and is
deployed on [Netlify](https://www.netlify.com/).

## Features

- **Email & password auth** — sign up and sign in with Supabase Auth (email
  confirmation is enabled).
- **Record or upload audio** — capture a cast right in the app, or pick an
  existing audio file from your device.
- **Private, friend-only feed** — you only ever see casts from yourself and the
  friends you've connected with, enforced by Postgres row-level security.
- **Invite codes** — generate a short code and share it with someone special;
  redeeming a code creates a two-way friendship.
- **Cross-platform** — one codebase for web, iOS, and Android (web is the primary
  target right now).

## Tech stack

- **App:** Expo SDK 52, React Native 0.76, react-native-web
- **Backend:** Supabase — Auth, Postgres (with RLS), and Storage (private `casts`
  audio bucket)
- **Web hosting:** Netlify

### Repo layout

```
cozycast/
├── app/                  # Expo (React Native) app — iOS, Android, web
│   ├── App.js            # App entry / tab navigation (Feed, Record, Profile)
│   └── src/
│       ├── api/          # Supabase client + data access helpers
│       ├── context/      # Auth context
│       ├── screens/      # Login, Feed, Record, Profile
│       ├── components/   # Cast card, audio player
│       └── utils/        # Cross-platform helpers (e.g. web-safe alerts)
├── supabase/
│   ├── config.toml       # Project + storage bucket config
│   └── migrations/       # Postgres schema, RLS policies, and RPC functions
└── netlify.toml          # Web deploy config
```

## Getting started locally

### Prerequisites

- [Node.js 20](https://nodejs.org/)
- npm

### Install and run

```bash
cd app
npm install
npx expo start
```

From the Expo dev server you can open the app on any platform:

```bash
npx expo start --web      # browser
npx expo start --ios      # iOS simulator / Expo Go
npx expo start --android  # Android emulator / Expo Go
```

### Environment variables

The app reads its Supabase connection from `EXPO_PUBLIC_*` environment variables:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable / anon key |
| `EXPO_PUBLIC_SITE_URL` | Base URL used for email confirmation redirects (defaults to `https://cozycast.jall.me`) |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN for error tracking (set in the build env; reporting is off when unset) |

Config is read from the environment (12-factor) — nothing is hardcoded in the
repo. Copy [`app/.env.example`](app/.env.example) to `app/.env` and fill it in
for local dev; the same vars are set in the Netlify build env for deploys. The
Supabase vars are **required** (the app throws on startup if they're missing);
`EXPO_PUBLIC_SITE_URL` defaults to `https://cozycast.jall.me`, and
`EXPO_PUBLIC_SENTRY_DSN` is optional (reporting is off when unset).

> **Note:** Because email confirmation is enabled, new signups must confirm via
> the email link before they can log in. Make sure your Supabase **Auth → URL
> Configuration** lists your site URL as both the Site URL and an allowed
> redirect, or confirmation links will break.

## Building for web

```bash
cd app
npx expo export --platform web
```

This produces a static web build in `app/dist/`.

## Deployment

### Web (Netlify)

The web app deploys to Netlify using the settings in
[`netlify.toml`](netlify.toml):

- **Base directory:** `app/`
- **Build command:** `npx expo export --platform web`
- **Publish directory:** `dist`
- **Node version:** 20

A SPA redirect serves `index.html` for client-side routes, so deep links work
without shadowing the bundled JS or assets.

### Database & storage (Supabase)

Schema, row-level security policies, and storage rules live as SQL migrations
under [`supabase/migrations/`](supabase/migrations/). They're applied through
Supabase's GitHub integration: push new migration SQL to `main` and Supabase
picks it up. The private `casts` audio bucket is declared in
[`supabase/config.toml`](supabase/config.toml).

## Error tracking

Runtime errors are reported to [Sentry](https://sentry.io/) via
`@sentry/react-native` (initialised in `app/App.js`). Reporting is **disabled in
local development** (`__DEV__`) and only active in real builds. The DSN is read
from `EXPO_PUBLIC_SENTRY_DSN` (12-factor — set it in the build environment);
when it's unset, Sentry stays off. Readable stack traces via source-map upload
(which needs a secret `SENTRY_AUTH_TOKEN`) are a later enhancement.

## Project status

cozycast is **pre-v1** and iterating fast. While we get to a first release, we're
committing directly to `main` rather than using feature branches and PRs — this
will switch back to branches + PRs + CI once v1 ships and we have real users.
There's ongoing pre-v1 cleanup work (for example, removing the seeded test
account) tracked before go-live.
