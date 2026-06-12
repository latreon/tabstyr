import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const FULL = readFileSync(resolve(ROOT, 'assets/icon.svg'));

// 16/32px: no plate, thicker strokes — legible at toolbar size.
const SMALL = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#60a5fa"/></linearGradient></defs>
  <circle cx="32" cy="32" r="22" fill="none" stroke="#3a3a4a" stroke-width="11"/>
  <path d="M 32 10 A 22 22 0 1 1 13.4 43" fill="none" stroke="url(#g)" stroke-width="11" stroke-linecap="round"/>
  <line x1="32" y1="32" x2="32" y2="18" stroke="#7c5cf0" stroke-width="7" stroke-linecap="round"/>
  <line x1="32" y1="32" x2="42" y2="38" stroke="#7c5cf0" stroke-width="7" stroke-linecap="round"/>
</svg>`;

mkdirSync(resolve(ROOT, 'public/icon'), { recursive: true });
for (const size of [16, 32]) {
  await sharp(Buffer.from(SMALL)).resize(size, size).png().toFile(resolve(ROOT, `public/icon/${size}.png`));
}
for (const size of [48, 96, 128]) {
  await sharp(FULL).resize(size, size).png().toFile(resolve(ROOT, `public/icon/${size}.png`));
}
console.log('icons written to public/icon/');
