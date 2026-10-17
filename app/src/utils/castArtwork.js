import { Platform } from 'react-native';
import { coverFor, COVER_FLAME, COVER_FLAME_CORE } from './castCover';

// Render the deterministic cover to a high-res PNG data URL for the OS media
// session (iOS lock screen / control center, Android notification). Without this
// those surfaces fall back to the tiny favicon. Web only — returns null
// elsewhere or if canvas isn't available. Draws the exact same night scene as
// <CastCover>: the geometry is SVG path data in a 100×100 box, which canvas can
// fill directly via Path2D once scaled.
export function castArtworkDataUrl(seed, title, size = 512) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  try {
    const c = coverFor(seed, title);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof Path2D === 'undefined') return null;

    ctx.scale(size / 100, size / 100);
    const fill = (color, draw, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      draw();
      ctx.globalAlpha = 1;
    };
    const circle = (x, y, r) => () => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    const path = (d) => () => ctx.fill(new Path2D(d));

    fill(c.sky, () => ctx.fillRect(0, 0, 100, 100));
    c.stars.forEach(([x, y], i) => fill('#F5EADB', circle(x, y, i === 1 ? 1.1 : 0.8), 0.7));
    fill(c.moon, circle(c.moonX, c.moonY, 13));
    fill(c.hill1, path(c.far));
    fill(c.hill2, path(c.near));
    fill(
      '#FF7A3D',
      () => {
        ctx.beginPath();
        ctx.ellipse(50, 95, 11, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
      },
      0.5,
    );
    fill('#FF8A3D', path(COVER_FLAME));
    fill('#FFE2A6', path(COVER_FLAME_CORE));

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
