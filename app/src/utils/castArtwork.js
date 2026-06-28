import { Platform } from 'react-native';
import { coverFor } from './castCover';

// Render the deterministic cover to a high-res PNG data URL for the OS media
// session (iOS lock screen / control center, Android notification). Without this
// those surfaces fall back to the tiny favicon. Web only — returns null
// elsewhere or if canvas isn't available. Mirrors <CastCover>'s layered look,
// but keeps the emoji glyph (drawing icon fonts to canvas is impractical).
export function castArtworkDataUrl(seed, title, size = 512) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  try {
    const { base, accent, deep, glyph, blobs } = coverFor(seed, title);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Base fill.
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    const circle = (x, y, r, color, alpha) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    // Light accent blob + deeper shade blob + faint highlight — same layout as
    // the on-screen cover.
    circle(size * blobs.accentX, size * blobs.accentY, size * 0.52, accent, 0.55);
    circle(size * blobs.deepX, size * blobs.deepY, size * 0.4, deep, 0.45);
    circle(-size * 0.1, -size * 0.1, size * 0.4, '#FFFFFF', 0.12);

    // Centered glyph.
    ctx.font = `${Math.round(size * 0.4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, size / 2, size / 2 + size * 0.03);

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
