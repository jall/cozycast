# Review notes — cozy-pass + foundations

Notes for @jall to review when you're back. This file is safe to delete once
you've gone through it (it's just a hand-off, not part of the app).

Everything below is on `main` and deployed to https://cozycast.jall.me. CI is
green; the Supabase migration is applied to prod. Test account for poking
around: `test@cozycast.app` / `cozytest1234`.

## How to review quickly

- **Just look:** open https://cozycast.jall.me — landing → "Read the manifesto",
  then sign in with the test account and try Record → Share, and the Profile tab.
- **Run locally:** `cd app && npm install && npm run check` (lint+format+unit,
  fast/offline), then `npx expo start --web`. Needs `app/.env` (copy
  `app/.env.example`); ask me for the values or reuse the Netlify build env.
- **E2E:** `cd app && npm run test:e2e` (defaults to prod; set `E2E_EMAIL`/
  `E2E_PASSWORD` to include the signed-in + recording checks).

## What shipped this stretch (newest first)

1. **Cozy states + the "soft game"** (`befd291`) — skeleton feed loader, warmer
   empty state, and conversation prompts on the record screen.
2. **Motion** (`e61c2bc`) — breathing record button, staggered card fade-ins.
3. **Typography** (`cd6983e`) — Nunito across the app.
4. **Warm toasts** (`2c453aa`) — replaced native `alert()`; closed issue #4.
5. **Deploy-aware CI** (`07b4938`/`983d5a5`/`6723838`) — e2e tests the Netlify
   deploy of the exact commit.
6. Earlier in the session: explicit per-cast **sharing rebuild**, landing +
   manifesto, procedural cover art, Playwright E2E + record/stream tests, CI,
   non-prod seed fixtures, Supabase migration.

## Review points by area

### Sharing model (the big one) — `supabase/migrations/20260621000000_explicit_sharing.sql`, `app/src/api/client.js`
- A cast is visible only to creator / sharer / tagged participants / explicit
  recipients. Friends are now an address book, not a feed.
- **Check:** are the RLS rules what you want? In particular — should **recipients
  be able to see the full recipient list** of a cast? Right now anyone with
  access can read `cast_recipients` (via `can_access_cast`). Easy to tighten to
  managers-only if you'd prefer privacy there.
- **Check:** a tagged participant gets access **only if they're an app user**
  (we set `profile_id`). Tagging a non-user is display-only — intended?

### Cozy feel (the subjective stuff — your call)
- **Toasts** (`app/src/context/ToastContext.js`): tone/colour/duration (3.4s),
  position (top). Microcopy like "Sent to 3 people 🌿" — keep the emoji?
- **Typography** (`app/src/theme/typography.js`): Nunito everywhere. If you'd
  rather a distinct *display* face for just the wordmark, that's a small change.
  Body in some app screens is still system — deliberate (readability); say if
  you want Nunito on literally everything.
- **Motion** (`RecordScreen` halo, `CastCard` fade-in): speeds/intensities are
  easy to dial. The breathing halo loops forever while recording — intended.
- **Soft game** (`app/src/constants/tips.js`): the prompt copy is mine — please
  reword to taste. It currently shows a random tip per visit to Record.

### Things I decided without you (sanity-check these)
- **Worked on `main`** (per your pre-v1 note) and **applied the destructive
  migration to prod** (you OK'd this) — there was no real data.
- **Seed fixtures** (`supabase/seed.sql`) create 3 fake users + sample casts for
  local `supabase db reset` only — never prod.
- **Kept the seeded `test@cozycast.app`** account (pre-v1). Still on the cleanup
  list (#2-ish) before launch.
- Added one dependency: `@expo-google-fonts/nunito` (fonts only).

### Known risks / watch-items
- The bundled JS is ~2 MB; fonts add a little. Fine for now, worth a perf pass
  pre-launch.
- Security advisor warns that the RLS helper functions are callable via the
  public API (benign — they only return the caller's own access). Tracked in #9.
- CI is advisory pre-v1 (we commit straight to `main`); it does not block.

## Open tickets (fast-follows)

- **#6** AI summaries + cover art (Supabase Edge Function) — needs a provider key.
- **#7** Google login (Supabase OAuth) — needs a Google Cloud client from you.
- **#8** Manage/re-share recipients after creation (sharer-isn't-creator flow).
- **#9** Security-advisor cleanup (move RLS helpers off the public schema; enable
  leaked-password protection).

## Suggested next steps (when you're ready)
- Eyeball the cozy feel and tell me what to dial.
- Decide on AI (#6) — it's the biggest remaining spec item and needs a key/budget.
- Pre-v1 cleanup pass (remove test account, flip off direct-to-`main`).
