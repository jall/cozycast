// Type scale for cozycast (Campfire). Ready-made style objects — never set
// `fontWeight` (the weight is baked into the family; fontWeight breaks custom
// fonts on web). See docs/design-vision.md. Colours intentionally omitted so
// callers pick an ink role.
import { fonts } from './typography';

export const type = {
  // Moments — the storyteller's italic ("Gather round.", "Along the way").
  moment: { fontFamily: fonts.serifItalic, fontSize: 44, lineHeight: 48, letterSpacing: -1 },
  display: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 46, letterSpacing: -0.8 },
  wordmark: { fontFamily: fonts.serifBold, fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 26, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  // Section labels — sentence case, gentle tracking (NOT all-caps).
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  // Tiny mono labels ("SUNDAY EVENING", "BY THE FIRE NOW") — the one place we
  // use caps, set in mono so it reads as a label rather than shouting.
  monoLabel: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 26 },
  bodySm: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  // Time: positions, durations, timestamps.
  time: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  numeric: {
    fontFamily: fonts.mono,
    fontSize: 52,
    lineHeight: 58,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
};

export default type;
