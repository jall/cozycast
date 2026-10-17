// Deterministic cover art derived from a cast's id: same input → same little
// night scene, no image generation needed. Sky, a moon, two ridgelines and one
// small fire — like a linocut postcard from the evening it was recorded.
// Shared by the on-screen <CastCover> (SVG) and the raster artwork handed to
// the OS media session (lock screen / control center), which draws the same
// paths to a canvas. A richer AI-generated cover can replace this later behind
// an Edge Function (#6).

// Night palettes: sky, moon, a near ridge and a far ridge, plus the glow colour
// the cast casts on its surroundings when it's the one playing.
export const PALETTES = [
  { sky: '#2B2547', moon: '#FFD9A0', hill1: '#463A6B', hill2: '#17122A', glow: '#FF965A' },
  { sky: '#14303A', moon: '#F5EADB', hill1: '#24505A', hill2: '#0D1C22', glow: '#78C8B4' },
  { sky: '#4A2626', moon: '#FFB547', hill1: '#6E3B2E', hill2: '#241312', glow: '#FFAA46' },
  { sky: '#2E1F3D', moon: '#C9A2E0', hill1: '#4B3463', hill2: '#1A1126', glow: '#C8A0E6' },
  { sky: '#1E2A44', moon: '#FFE2A6', hill1: '#2F4466', hill2: '#111A2C', glow: '#9DB8E8' },
  { sky: '#3A2A1E', moon: '#F5EADB', hill1: '#5C4330', hill2: '#1E150F', glow: '#E8C77A' },
  { sky: '#1F3326', moon: '#E8F0C8', hill1: '#335240', hill2: '#0F1C14', glow: '#A8D89A' },
  { sky: '#3D1F2E', moon: '#FFC2A6', hill1: '#5E2F45', hill2: '#1E0F17', glow: '#FF9A8A' },
];

export function hash(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0; // force 32-bit
  }
  return Math.abs(h);
}

// A smooth ridge across the 100×100 cover: starts at `y0`, dips/rises through a
// control point, and the `T` continuation mirrors it for a gentle second hump.
function ridge(y0, peak, mid, end) {
  return `M0 ${y0} Q25 ${peak} 50 ${mid} T100 ${end} V100 H0Z`;
}

// The scene for a given cast (keyed by id, falling back to title). All
// geometry is in a 100×100 viewBox.
export function coverFor(seed, title) {
  const h = hash(seed || title || 'cozycast');
  const palette = PALETTES[h % PALETTES.length];
  const moonX = 22 + ((h >> 4) % 7) * 9; // 22–76
  const moonY = 30 + ((h >> 7) % 3) * 4; // 30–38
  const far = 54 + ((h >> 9) % 4) * 4; // far ridge baseline 54–66
  const near = 74 + ((h >> 11) % 3) * 4; // near ridge baseline 74–82
  return {
    ...palette,
    moonX,
    moonY,
    far: ridge(far, far - 14 + ((h >> 13) % 3) * 4, far + 4, far - 4 + ((h >> 15) % 3) * 4),
    near: ridge(near, near - 12, near + 2, near - 4 + ((h >> 17) % 3) * 3),
    stars: [
      [12 + ((h >> 2) % 6), 14],
      [82 - ((h >> 5) % 8), 10 + ((h >> 8) % 6)],
      [48 + ((h >> 10) % 10), 22],
    ],
  };
}

// The little fire at the foot of every cover (same 100×100 space).
export const COVER_FLAME =
  'M50 76 C55 83 57 87 55 91 C54 94 52 95 50 95 C48 95 46 94 45 91 C43 87 45 83 50 76 Z';
export const COVER_FLAME_CORE =
  'M50 83 C52.5 86 53.5 88 52.6 90.6 C52 92.4 51 93 50 93 C49 93 48 92.4 47.4 90.6 C46.5 88 47.5 86 50 83 Z';
