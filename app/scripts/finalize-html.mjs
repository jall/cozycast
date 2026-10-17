// Fill in the public site URL in the exported index.html (link-preview image
// URLs must be absolute). Config comes from the environment, like everything
// else: EXPO_PUBLIC_SITE_URL, defaulting to the production site.
//
// Usage: node scripts/finalize-html.mjs dist
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'dist';
const site = (process.env.EXPO_PUBLIC_SITE_URL || 'https://cozycast.jall.me').replace(/\/+$/, '');
const file = join(dir, 'index.html');
const html = readFileSync(file, 'utf8');
writeFileSync(file, html.replaceAll('__SITE_URL__', site));
console.log(`finalize-html: link previews point at ${site}`);
