# cozycast — design vision & language

A north-star for how cozycast should look and feel, plus a concrete design
system to implement it. Derived from a design review of the current UI against
the manifesto (`app/src/screens/ManifestoScreen.js`). Living document — refine as
we build.

---

## North star

> **cozycast is a lamp-lit room, not a stage.** Opening it should feel like
> stepping into a warm, low-lit space where a few people you trust have left
> their voices for you. The emotion is *being thought of* — the quiet pleasure
> of "someone recorded this for me." Every surface should feel unhurried,
> soft-edged, and a little handmade, as if the app were knitted rather than
> shipped.

The feeling, in three words: **warm, hushed, intentional.**

- **Like:** a voice note from someone you love; a physical letter; the
  *Things*/*Bear* school of calm-but-crafted; a paper lantern; analog warmth
  (vinyl, cassette, a kitchen radio); podcast/NPR intimacy without the gloss.
- **Unlike:** every feed app. No badges-as-dopamine, no infinite scroll, no
  "engagement." Unlike Discord/Slack (busy, notification-driven), Clubhouse
  (performative live stages), Instagram. **The absence of an audience is the
  product.**

**Three principles that turn the manifesto into pixels:**

1. **Calm has weight.** Generous whitespace, slow motion, muted color, one
   accent. Emptiness is a feature, not a state to fill.
2. **Warmth is made by hand.** Texture, slightly imperfect cover art, rounded
   everything, warm shadows (never pure black), language that sounds like a
   person.
3. **Intimacy over information.** Lead with *who* and *the voice*, not metadata
   and counts. The fewer numbers on screen, the cozier it feels.

---

## Where the current UI is weak (audit summary)

Good bones — coherent warm palette, Nunito throughout, soft rounded cards,
gentle entrance/"breathing" animations, lovely microcopy. What's missing is
**system and intention**:

- **One orange (`#E8734A`) does five jobs** — wordmark, every button, every
  active state, links, accents, progress, the unread dot. Nothing feels special
  and the eye never rests. There's no theme color module; ~12 files retype the
  same hexes, and near-duplicate tints have drifted (`#FCEDE6` / `#FFF0E6` /
  `#FFF3EA` / `#FFF3E9` all mean "soft peach"). Six muted browns with no roles.
- **Off-palette semantics** — a Material green (`#4CAF50`) for "Audio ready"/done
  sits in an otherwise hand-warmed world; danger red is inconsistent.
- **No type scale** — ~15 font sizes, sibling screens disagree (screen titles
  24 vs 28; wordmark 28/42/48). `fontWeight` is used in several files despite
  CLAUDE.md warning it silently breaks Nunito on web.
- **No spacing/radius grid** — card radius alone is 12/16/18/20; top insets are
  hardcoded `paddingTop: 56/72` instead of safe-area.
- **Flat single shadow on everything** — no depth hierarchy; the only
  differentiated elevation is a heavy orange glow on buttons.
- **The "Feed"** — a reverse-chron scroll labelled "Feed" is the one screen that
  most contradicts "no feed, no stage."
- **Procedural cover art is the weakest, most-repeated element** — a flat color +
  OS-dependent emoji. It should be where identity lives.
- **The audio player is generic** — no waveform, no scrub, no skip-back; for an
  audio app it's the least-considered surface.

---

## Design language

### Color — roles, not just hex

Create `app/src/theme/colors.js` and import everywhere. The single most
important rule: **demote orange to "primary action + brand mark only."** Active
tabs, links, small labels, and tags move to a text-ink or neutral active state.

**Surfaces (warm neutrals)**
| Token | Hex | Use |
|---|---|---|
| `bg` | `#FBF3E9` | app background (warmer than the current cool `#FFF8F0`) |
| `surface` | `#FFFFFF` | cards |
| `surfaceSunk` | `#F6ECDF` | inset fields, tracks |
| `accentSurface` | `#FBEADF` | the one canonical "soft peach" (kills the 4 drifting tints) |
| `hairline` | `#EFE3D5` | borders/dividers (one value) |

**Ink (text ramp)**
| Token | Hex | Use |
|---|---|---|
| `ink` | `#2A2521` | primary text (warm near-black) |
| `inkSoft` | `#6B5E50` | body / secondary |
| `inkMuted` | `#9C8B79` | captions, bylines, timestamps (collapses 3 browns) |
| `inkFaint` | `#C4B5A8` | placeholders, disabled |

**Accent (terracotta — rationed)**
| Token | Hex | Use |
|---|---|---|
| `ember` | `#E0683E` | the one true accent: primary buttons, play button, wordmark |
| `emberSoft` | `#F4A261` | secondary accent / gradients / avatar fills |
| `emberInk` | `#B5482E` | accent *text* on light (links, labels) so small text isn't loud orange |

**Semantic (on-palette)**
| Token | Hex | Use |
|---|---|---|
| `success` / `successSurface` | `#5E8C61` / `#E9F1E6` | sage, replaces Material green |
| `danger` / `dangerSurface` | `#C0563D` / `#FBE7E0` | one terracotta-leaning red |

### Type — Nunito, with a scale

Create `app/src/theme/type.js` exporting ready-made style objects. **Never set
`fontWeight`** (weight is baked into the family — audit and remove all
instances). Negative letter-spacing (−0.5) on display/h1.

| Token | Size / line | Family | Use |
|---|---|---|---|
| `display` | 40 / 46 | display (800) | landing/login wordmark only |
| `wordmark` | 26 / 30 | display | feed header wordmark (pick ONE size) |
| `h1` | 28 / 34 | display | screen titles (unify the 24/28 split) |
| `h2` | 20 / 26 | bold (700) | card titles, section headlines |
| `h3` | 16 / 22 | bold | list-item titles, choice cards |
| `eyebrow` | 12 / 16 | bold, +0.5, **sentence case** | section labels (no ALL-CAPS) |
| `body` | 16 / 26 | regular | manifesto/landing body |
| `bodySm` | 14 / 21 | regular | card summary, comments |
| `label` | 13 / 18 | medium (600) | form labels |
| `caption` | 12 / 16 | regular | bylines, timestamps |
| `numeric` | 44 / 48 | display, tabular-nums | recording timer |

### Spacing / radius / elevation

- **Spacing — 4pt base, named:** `xs 4, sm 8, md 12, lg 16, xl 24, 2xl 32,
  3xl 48`. Replace hardcoded top insets with `useSafeAreaInsets()` + `xl`.
- **Radius — three values:** `sm 12` (fields, chips, comments), `md 18` (all
  cards — enforce), `pill 999` (avatars, buttons, play). Collapse the current
  4/10/11/12/14/16/18/19/20/22.
- **Elevation — three levels, warm shadow** (shadow color a low-opacity warm
  brown, never `#000`): `flat` (none), `rest` (y2/blur10/0.05, cards),
  `raised` (y6/blur20/0.10, mini player, toast, modals). Drop the orange glow on
  buttons.

### Motion — slow and soft

- Durations: `quick 160ms` (toggles), `gentle 280ms` (enters), `breathe 1100ms`
  (ambient). Ease-out for enters; a soft spring for press.
- **Press = settle, not flash.** Replace `activeOpacity` with a `scale: 0.97`
  spring (`Pressable`).
- **Crossfade, never cut** — the Record `mode` changes and CastDetail load should
  transition gently.
- Animate state quietly: progress tweens, play↔pause crossfades, the unread dot
  fades in. Motion is reserved for meaning — it should feel like breathing, not
  loading.

### Iconography

- Unify on **outline** Ionicons at one stroke weight; fill only the *active* tab.
- Icons `inkMuted` by default, `ember` only when active/primary.
- **Replace the cover-art emoji** with ~10 simple custom line-glyphs (steam, moon,
  leaf, flame, teapot, radio) matched to the icon weight — stops depending on OS
  emoji rendering.

### Voice & tone

Speak like a kind friend, not a product. Lowercase the brand ("cozycast", "a
cozy cast" — fix the "Cozy Cast" capitalization). Sentence case, never ALL CAPS.
Warmth over instruction; quiet wit. Never use growth/engagement language (shares,
reach, audience, moments).

| Where | Before | After |
|---|---|---|
| Login tagline | "share moments with the people who matter" | "for the conversations worth keeping" |
| Record start | "New Cast" / "Record a conversation, then choose who hears it" | "Start a cast" / "say something, then choose who hears it" |
| Form step | "Add some details" / "Tell people what this conversation was" | "A few words" / "what was this conversation?" |
| Continue btn | "Continue to sharing" | "Choose who hears it" |
| Done | "All set!" | "It's kept." / "your cast is safe, and on its way to the people you chose." |
| Audio ready | "Audio ready" | "Got it — sounds good." |
| Section labels | "WHAT IS A COZY CAST?", "TITLE" | sentence-case eyebrow: "what is a cozy cast", "title" |
| Tabs | Feed / Record / Profile | Home / Record / You |
| Recipients | "Share with…" / "Pick exactly who receives this." | "Who's this for?" / "choose the people who get to hear it. no one else, ever." |

Keep verbatim (the tonal benchmark): "Stay cozy.", "It lands gently", "Nothing
yet — it's calm in here.", "It's quiet here…", "a tiny game", "Sent to one
person 🌿".

---

## Signature moments (distinctive, low-cost)

1. **Cover art that feels handmade.** Keep the deterministic-from-id idea, but
   render a soft two-tone gradient + a layered organic "blob" cluster (2–3
   overlapping translucent circles at deterministic offsets) + a custom
   line-glyph + a subtle grain overlay. Same `coverFor(seed)` API, ~10× the
   warmth, still zero image-gen. Lifts the feed, mini player, detail hero, and
   lock-screen artwork at once.
2. **Recording as a calm ritual.** Lean into the breathing halo: dim the
   background to a deeper warm tone while recording ("you're in the room"), make
   the timer a thin display numeral, add a gentle live amplitude ring around the
   stop button (expo-av metering). Lighting a candle, not arming a device.
3. **Receiving = a small unwrapping.** First time you open a cast shared *with*
   you, play a one-time gentle reveal: cover fades/scales in, then the title,
   then "left for you by Ben." A gift on the doorstep, not a feed row.
4. **A calm home, not a feed.** Reframe the signed-in top from "feed + bell" to a
   quiet, time-of-day greeting ("good evening. it's quiet and that's okay.") with
   unheard casts gently surfaced ("a couple of voices waiting for you"). Numbers
   and the bell recede. Delivers "no feed, no stage" exactly where a user expects
   a feed.

---

## Screen-by-screen direction

- **Landing** — strong; replace the Instagram-y tagline, give the hero a wash of
  warmth (soft ember glow / a drifting cover-blob behind the wordmark),
  sentence-case the eyebrow, let "It lands gently" be the emotional closer.
- **Home/Feed** — add the calm-home greeting; demote the bell (`inkMuted`,
  smaller). Cards: unify radius, warm `rest` shadow, press-scale; lead with cover
  + *who*, soften metadata, drop visible counts. Tab bar: outline icons, active =
  filled + `ember`, "Home/Record/You", safe-area bottom inset.
- **Record** — the flow most needing cohesion: apply the ritual, crossfade
  between modes, re-voice every string, sage `success` for "audio ready", make
  "choose who hears it" the emotional peak. Remove all `fontWeight` (worst
  offender here).
- **Cast detail** — **promote the audio**: a proper player block under the hero
  (bigger play, a real scrubbable bar, −15s, `numeric` time). Let the cover hero
  breathe; consider the first-open reveal. Sentence-case section labels. Keep the
  excellent "missing cast" lock state.
- **Notifications** — tonally the best minor screen; minimal changes. Warm the
  unread tint to `accentSurface`, `inkMuted` time, consider renaming the header
  from "Notifications" to something quieter ("Lately"). Keep "Nothing yet — it's
  calm in here." forever.

---

## Prioritized roadmap (highest leverage first)

| # | Change | Why | Effort |
|---|---|---|---|
| 1 | `theme/colors.js` + `theme/type.js` + `theme/space.js`; refactor all screens to import them | Stops hex/size drift, gives one knob for the whole app; prerequisite for the rest | **M** (mechanical, ~12 files) |
| 2 | **Ration the orange** (accent → ink/`emberInk` for links/labels/active; `ember` only for primary buttons + play + wordmark) | Instantly turns "branded" into "calm"; nearly free given #1 | **S** |
| 3 | Remove every `fontWeight`; apply the type scale | Fixes documented Nunito breakage on web; unifies title sizes | **S–M** |
| 4 | Re-voice off-tone strings (login tagline, Record flow, sentence-case labels, "Cozy Cast"→"cozycast") | Pure copy; the brand's superpower; near-zero risk | **S** |
| 5 | Bring semantic colors on-palette (Material green → sage; one danger red) | Removes the only jarring colors | **S** |
| 6 | Redesign procedural cover art (gradient + blobs + custom glyph + grain) | Most-repeated, currently-weakest element; biggest felt upgrade | **M** |
| 7 | Warm shadow system + 3 elevations; unify card radius | Depth/calm; cheap after #1 | **S** |
| 8 | Calm-home greeting header | Delivers "no feed, no stage" | **S** |
| 9 | Press-scale + crossfade motion; animate progress + play/pause | Turns motion into a language | **M** |
| 10 | Proper audio player on detail (scrub, −15s, bigger controls) | It's an audio app — the player should be the best surface | **M–L** |
| 11 | Recording ritual + "received as a gift" reveal | The two moments that make people *feel* something | **M** |

**If we only do three things first:** #1 (tokens), #2 (ration orange), #4
(re-voice) — mostly mechanical, low risk, and they make cozycast feel
meaningfully more like *itself* before touching a single new component.
