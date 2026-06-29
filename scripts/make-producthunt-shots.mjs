// Regenerate the Product Hunt screenshot set from the 2× captures so every still
// is retina-sourced (then sized to the conventional dimensions).
//
//   • dashboard sections  → sliced from docs/store/screenshots/dashboard-<theme>.png (2×)
//   • popup               → docs/store/screenshots/popup-<theme>.png (2×) → 360×620
//   • modals              → e2e/__screenshots__/modal-<kind>-<theme>.png (2×) → 1280×800
//
// Run after `npm run e2e` has refreshed the captures.
//   node scripts/make-producthunt-shots.mjs
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CAPS = resolve(ROOT, 'docs/store/screenshots');
const E2E = resolve(ROOT, 'e2e/__screenshots__');
const OUT = resolve(ROOT, 'docs/store/producthunt/screenshots');
mkdirSync(OUT, { recursive: true });

const W = 1280, H = 800;

// Dashboard sections, authored in 1280-wide coords (auto-scaled to the capture).
const SECTIONS = [
  { name: 'overview', top: 0 },
  { name: 'trends', top: 560 },
  { name: 'heatmap-comparison', top: 1080 },
  { name: 'worklog-settings', top: 1820 },
];

async function slice(srcPath, top1x, outPath) {
  const meta = await sharp(srcPath).metadata();
  const sc = (meta.width ?? W) / W;
  const winH = Math.round(H * sc);
  const maxTop = Math.max(0, (meta.height ?? winH) - winH);
  await sharp(srcPath)
    .extract({ left: 0, top: Math.min(Math.round(top1x * sc), maxTop), width: Math.round(W * sc), height: winH })
    .resize(W, H, { kernel: 'lanczos3' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`wrote ${outPath.replace(ROOT + '/', '')}`);
}

async function fit(srcPath, w, h, outPath) {
  await sharp(srcPath)
    .resize(w, h, { kernel: 'lanczos3' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`wrote ${outPath.replace(ROOT + '/', '')}`);
}

for (const theme of ['dark', 'light']) {
  const dash = resolve(CAPS, `dashboard-${theme}.png`);
  for (const s of SECTIONS) await slice(dash, s.top, resolve(OUT, `${s.name}-${theme}.png`));
  await fit(resolve(CAPS, `popup-${theme}.png`), 360, 620, resolve(OUT, `popup-${theme}.png`));
  for (const kind of ['domain', 'onboarding', 'privacy']) {
    await fit(resolve(E2E, `modal-${kind}-${theme}.png`), W, H, resolve(OUT, `modal-${kind}-${theme}.png`));
  }
}
console.log('done — Product Hunt screenshots regenerated at 2× source quality');
