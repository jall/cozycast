// Deterministic cover art derived from a cast's id: same input → same warm
// look, no image generation needed. Shared by the on-screen <CastCover> and the
// raster artwork we hand to the OS media session (lock screen / control center).
// (A richer AI-generated cover can replace this later behind an Edge Function.)

// Cozy two-tone palettes (background + soft accent blob).
export const PALETTES = [
  ['#E8734A', '#F4A261'],
  ['#C97B5A', '#E8A87C'],
  ['#A8763E', '#E8C06A'],
  ['#7C9A7E', '#B5CDA3'],
  ['#6B8E9E', '#A9C5D1'],
  ['#9B6A8F', '#D2A6C7'],
  ['#B5654A', '#E89B7C'],
  ['#8A8FB0', '#C2C6E0'],
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

// The palette + glyph for a given cast (keyed by id, falling back to title).
export function coverFor(seed, title) {
  const h = hash(seed || title || 'cozycast');
  const [base, accent] = PALETTES[h % PALETTES.length];
  const glyph = GLYPHS[(h >> 3) % GLYPHS.length];
  return { base, accent, glyph };
}
