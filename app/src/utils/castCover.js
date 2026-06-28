// Deterministic cover art derived from a cast's id: same input → same warm,
// handmade-feeling look, no image generation needed. Shared by the on-screen
// <CastCover> and the raster artwork handed to the OS media session (lock
// screen / control center). A richer AI-generated cover can replace this later
// behind an Edge Function (#6).

// Cozy palettes: a base, a soft accent (light blob), and a deeper shade (for a
// gradient-ish second blob and depth).
export const PALETTES = [
  { base: '#E8734A', accent: '#F4A261', deep: '#C2562F' },
  { base: '#C97B5A', accent: '#E8A87C', deep: '#A85C3E' },
  { base: '#A8763E', accent: '#E8C06A', deep: '#855A28' },
  { base: '#7C9A7E', accent: '#B5CDA3', deep: '#5E7C60' },
  { base: '#6B8E9E', accent: '#A9C5D1', deep: '#4E707F' },
  { base: '#9B6A8F', accent: '#D2A6C7', deep: '#7A4E70' },
  { base: '#B5654A', accent: '#E89B7C', deep: '#8F4A33' },
  { base: '#8A8FB0', accent: '#C2C6E0', deep: '#686D8E' },
];

// Crisp line glyphs (Ionicons "-outline" names) — consistent across platforms,
// unlike system emoji. Order pairs with GLYPHS (the emoji fallback the canvas
// artwork still uses, since drawing icon fonts to canvas is impractical).
export const ICONS = [
  'cafe-outline',
  'moon-outline',
  'leaf-outline',
  'sparkles-outline',
  'flower-outline',
  'flame-outline',
  'wine-outline',
  'radio-outline',
  'bonfire-outline',
  'sunny-outline',
];

export const GLYPHS = ['☕', '🌙', '🍂', '✨', '🪴', '🔥', '🫖', '📻', '🕯️', '🌻'];

export function hash(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0; // force 32-bit
  }
  return Math.abs(h);
}

// The look for a given cast (keyed by id, falling back to title): palette, a
// glyph (icon for screens, emoji for canvas), and deterministic blob placement
// so each cover feels individually composed rather than stamped.
export function coverFor(seed, title) {
  const h = hash(seed || title || 'cozycast');
  const palette = PALETTES[h % PALETTES.length];
  const i = (h >> 3) % ICONS.length;
  // Deterministic blob offsets (fractions of the cover), nudged per cast.
  const accentX = 0.62 + ((h >> 6) % 5) * 0.05; // 0.62–0.82
  const accentY = 0.08 + ((h >> 9) % 4) * 0.05; // 0.08–0.23
  const deepX = 0.12 + ((h >> 12) % 4) * 0.05; // 0.12–0.27
  const deepY = 0.78 + ((h >> 15) % 4) * 0.04; // 0.78–0.90
  return {
    ...palette,
    icon: ICONS[i],
    glyph: GLYPHS[i],
    blobs: { accentX, accentY, deepX, deepY },
  };
}
