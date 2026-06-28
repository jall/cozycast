// Type scale for cozycast (Nunito). Ready-made style objects — never set
// `fontWeight` (the weight is baked into the family; fontWeight breaks Nunito on
// web). See docs/design-vision.md. Colours intentionally omitted so callers pick
// an ink role.
import { fonts } from './typography';

export const type = {
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46, letterSpacing: -0.5 },
  wordmark: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  // Section labels — sentence case, gentle tracking (NOT all-caps).
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 26 },
  bodySm: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  numeric: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 48,
    fontVariant: ['tabular-nums'],
  },
};

export default type;
