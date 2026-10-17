// Renders the link-preview image (public/og.png, 1200×630) and the home-screen
// icon (public/apple-touch-icon.png, 180×180): a campfire under a night sky in
// the app's own fonts. Re-run after changing the look:
//   PLAYWRIGHT_CHROMIUM_PATH=… node scripts/render-og-image.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const font = (p) => pathToFileURL(join(root, 'node_modules/@expo-google-fonts', p)).href;

const FIRE = `
  <svg viewBox="-60 -10 320 190" width="100%" height="100%" style="overflow:visible">
    <defs><radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#FF7A3D" stop-opacity=".5"/><stop offset=".5" stop-color="#FF7A3D" stop-opacity=".15"/><stop offset="1" stop-color="#FF7A3D" stop-opacity="0"/>
    </radialGradient></defs>
    <ellipse cx="100" cy="140" rx="150" ry="55" fill="url(#g)"/>
    <ellipse cx="100" cy="150" rx="78" ry="13" fill="#FF7A3D" opacity=".3"/>
    <circle cx="94" cy="20" r="2.4" fill="#FFB547"/><circle cx="110" cy="8" r="1.8" fill="#FFD9A0"/>
    <path d="M100 30 C120 66 142 86 132 118 C126 136 113 144 100 144 C87 144 74 136 68 118 C60 92 84 70 100 30 Z" fill="#FF6A2E"/>
    <path d="M101 62 C115 86 126 100 120 122 C116 134 109 140 100 140 C91 140 84 134 81 122 C76 104 90 88 101 62 Z" fill="#FFA23D"/>
    <path d="M100 94 C108 108 113 116 109 128 C107 134 104 137 100 137 C96 137 93 134 91 128 C88 118 94 108 100 94 Z" fill="#FFE2A6"/>
    <rect x="52" y="138" width="96" height="14" rx="7" fill="#5B3A2C" transform="rotate(-10 100 145)"/>
    <rect x="52" y="138" width="96" height="14" rx="7" fill="#6E4633" transform="rotate(10 100 145)"/>
  </svg>`;

// A seeded scatter, so re-renders don't reshuffle the sky.
let seed = 7;
const rand = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const stars = Array.from({ length: 70 }, () => {
  const s = rand() > 0.85 ? 3 : 2;
  return `<i style="left:${(rand() * 100).toFixed(1)}%;top:${(2 + rand() * 60).toFixed(1)}%;width:${s}px;height:${s}px;opacity:${(0.3 + rand() * 0.6).toFixed(2)}"></i>`;
}).join('');

const page = (w, h, body) => `<!doctype html><html><head><style>
  @font-face { font-family: F; src: url(${font('fraunces/500Medium_Italic/Fraunces_500Medium_Italic.ttf')}); }
  @font-face { font-family: N; src: url(${font('nunito/600SemiBold/Nunito_600SemiBold.ttf')}); }
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#120F18}
  .sky{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 120%,#3a2030 0%,#1A1526 55%,#120F18 100%)}
  i{position:absolute;border-radius:50%;background:#F5EADB}
  svg.hills{position:absolute;left:0;right:0;bottom:0;width:100%}
</style></head><body><div class="sky">${stars}</div>${body}</body></html>`;

const hills = `<svg class="hills" viewBox="0 0 800 120" preserveAspectRatio="none" height="150">
  <path d="M0 60 Q120 20 240 52 T480 46 T800 34 V120 H0Z" fill="#231B2E"/>
  <path d="M0 92 Q160 64 320 84 T640 78 T800 72 V120 H0Z" fill="#120F18"/></svg>`;

const og = page(
  1200,
  630,
  `${hills}
  <div style="position:absolute;left:96px;top:150px;width:720px">
    <div style="font-family:F;font-size:132px;line-height:1;color:#F5EADB;letter-spacing:-3px">cozycast</div>
    <div style="font-family:N;font-size:34px;line-height:1.35;color:#CDBFAE;margin-top:28px">Small, private conversations —<br/>shared only with the people you choose.</div>
  </div>
  <div style="position:absolute;right:70px;bottom:60px;width:420px;height:250px">${FIRE}</div>`,
);

const icon = page(
  180,
  180,
  `<div style="position:absolute;left:-10px;top:4px;width:200px;height:150px">${FIRE}</div>`,
);

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
for (const [html, w, h, out] of [
  [og, 1200, 630, 'public/og.png'],
  [icon, 180, 180, 'public/apple-touch-icon.png'],
]) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  // Load from a file (not setContent) so the file:// fonts are allowed.
  const file = join(mkdtempSync(join(tmpdir(), 'og-')), 'page.html');
  writeFileSync(file, html);
  await p.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: join(root, out) });
  console.log('wrote', out);
}
await browser.close();
