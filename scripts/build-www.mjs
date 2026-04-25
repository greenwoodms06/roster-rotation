// Mirrors the runtime web assets into www/ so Capacitor has a focused webDir
// to copy into android/app/src/main/assets/public/. The PWA at the repo root
// is unaffected — GitHub Pages still serves index.html from there.
//
// Run via `npm run build:www` (or implicitly via `npm run cap:sync`).

import { rmSync, mkdirSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const www = resolve(root, 'www');

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

const include = [
  'index.html',
  'privacy.html',
  'manifest.json',
  'sw.js',
  'css',
  'js',
  'icons',
  'fonts',
];

for (const item of include) {
  cpSync(resolve(root, item), resolve(www, item), { recursive: true });
}

console.log(`Built www/ — ${include.length} entries copied.`);
