// Slice the tall full-page dashboard captures (docs/store/screenshots/*.png,
// 1280×N) into Chrome-Web-Store-compliant 1280×800, 24-bit, no-alpha PNGs.
// Source captures come from `npm run e2e` (the "screenshots for visual review"
// test, seeded with sample data). Output → docs/store/screenshots/chrome/.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = resolve(ROOT, 'docs/store/screenshots');
const OUT = resolve(SRC, 'chrome');
mkdirSync(OUT, { recursive: true });

const W = 1280;
const H = 800;

// Each entry: source full-page capture + vertical offset of the 800px window.
// Offsets chosen to frame whole sections (above-the-fold hero, then lower rows).
const shots = [
  { src: 'dashboard-light.png', top: 0, name: '1-overview-light' },
  { src: 'dashboard-dark.png', top: 0, name: '2-overview-dark' },
  { src: 'dashboard-light.png', top: 560, name: '3-trends-light' },
  { src: 'dashboard-light.png', top: 1380, name: '4-heatmap-light' },
];

for (const s of shots) {
  const inPath = resolve(SRC, s.src);
  const meta = await sharp(inPath).metadata();
  // Source may be captured at 1× (1280 wide) or 2× (2560 wide). Slice the window
  // in source pixels, then downscale to the 1280×800 Chrome requirement.
  const scale = (meta.width ?? W) / W;
  const winW = Math.round(W * scale), winH = Math.round(H * scale);
  const top = Math.min(Math.round(s.top * scale), Math.max(0, (meta.height ?? winH) - winH));
  await sharp(inPath)
    .extract({ left: 0, top, width: winW, height: winH })
    .resize(W, H, { kernel: 'lanczos3' })
    .removeAlpha() // 24-bit, no alpha — Chrome requirement
    .png()
    .toFile(resolve(OUT, `${s.name}.png`));
  console.log(`wrote docs/store/screenshots/chrome/${s.name}.png  (from ${s.src} @${top}, ${scale}×)`);
}
console.log('done');
