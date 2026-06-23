import { Platform } from 'react-native';
import { coverFor } from './castCover';

// Render the deterministic cover to a high-res PNG data URL for the OS media
// session (iOS lock screen / control center, Android notification). Without this
// those surfaces fall back to the tiny favicon. Web only — returns null
// elsewhere or if canvas isn't available. Eventually this becomes the cast's
// real generated/uploaded cover image.
export function castArtworkDataUrl(seed, title, size = 512) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  try {
    const { base, accent, glyph } = coverFor(seed, title);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Base fill.
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // Soft accent blob toward the top-right, mirroring <CastCover>.
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(size * 0.775, size * 0.18, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Centered glyph.
    ctx.font = `${Math.round(size * 0.42)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, size / 2, size / 2 + size * 0.03);

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
