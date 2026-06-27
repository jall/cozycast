// Color roles for cozycast — a warm, hushed, intentional palette.
// See docs/design-vision.md. The cardinal rule: the terracotta `ember` accent is
// rationed to the primary action + the brand mark. Links, labels, and active
// states use `emberInk` (text) or muted ink — not loud orange everywhere.
export const colors = {
  // Surfaces (warm neutrals)
  bg: '#FBF3E9', // app background
  surface: '#FFFFFF', // cards
  surfaceSunk: '#F6ECDF', // inset fields, progress tracks
  accentSurface: '#FBEADF', // the one canonical "soft peach" tint
  hairline: '#EFE3D5', // borders / dividers

  // Ink (text ramp)
  ink: '#2A2521', // primary text (warm near-black)
  inkSoft: '#6B5E50', // body / secondary
  inkMuted: '#9C8B79', // captions, bylines, timestamps
  inkFaint: '#C4B5A8', // placeholders, disabled

  // Accent (terracotta — rationed)
  ember: '#E0683E', // primary action, play, wordmark — use sparingly
  emberSoft: '#F4A261', // secondary accent / gradients / avatar fills
  emberInk: '#B5482E', // accent *text* on light (links, labels)

  // On accent
  onEmber: '#FFFFFF',

  // Semantic (on-palette)
  success: '#5E8C61',
  successSurface: '#E9F1E6',
  danger: '#C0563D',
  dangerSurface: '#FBE7E0',

  // Pure white for text on saturated fills
  white: '#FFFFFF',
};

export default colors;
