// Color roles for cozycast — "Campfire": after dark, a few faces lit from below.
// One warm light source; everything else recedes into night. See
// docs/design-vision.md. The cardinal rule still holds: `ember` is rationed to
// what's *alive* — play, record, progress, the brand mark. Links, labels, and
// active states use `emberInk` (accent text on night) or muted ink.
export const colors = {
  // Surfaces (night, never pure black)
  bg: '#120F18', // night — the app ground
  surface: '#1F1A26', // dusk — cards, panels
  surfaceRaised: '#29222F', // card hover / raised sheets
  surfaceSunk: '#17131E', // inset fields, side panels
  accentSurface: '#2A1E1E', // coal — the one canonical ember-tinted surface
  hairline: '#2E2636', // borders / dividers
  smoke: '#3A3142', // unplayed waveform bars, quiet outlines

  // Ink (text ramp, warm cream on night)
  ink: '#F5EADB', // cream — primary text
  inkSoft: '#CDBFAE', // ash — body / secondary
  inkMuted: '#9C8E80', // driftwood — captions, bylines, timestamps (AA on dusk)
  inkFaint: '#6E6372', // placeholders, disabled

  // Accent (firelight — rationed)
  ember: '#FF7A3D', // primary action, play, progress, wordmark
  emberSoft: '#FFB547', // flame — live indicators, eyebrows, secondary accent
  emberInk: '#FFB89A', // accent *text* on night (links, labels)
  emberDeep: '#C56A45', // banked embers — progress on a cast that isn't playing

  // On accent (dark text reads better on bright ember than white does)
  onEmber: '#1B1012',

  // Semantic (on-palette)
  success: '#8CC7B0',
  successSurface: '#16262A',
  danger: '#FF8A73',
  dangerSurface: '#2E1A1A',

  // Pure white, for the rare thing that must read as light itself
  white: '#FFFFFF',
};

// Friends get a soft, distinct glow (avatar fallbacks, faces around a cast).
// All light enough that the initial is drawn in dark ink.
export const friendTints = ['#FFB547', '#8CC7B0', '#C9A2E0', '#E89A7A', '#9DB8E8', '#E8C77A'];

export default colors;
