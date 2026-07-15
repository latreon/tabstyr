// Slices the SAME source captures make-store-shots.mjs uses
// (docs/store/screenshots/dashboard-*.png, from `npm run e2e`) into Firefox AMO
// and Safari/Mac App Store Connect submission sizes. Chrome's own 1280×800 crops
// stay in make-store-shots.mjs, untouched — this is deliberately a separate file
// so a change here can never regress the already-working, already-referenced
// Chrome pipeline.
//
//   node scripts/make-store-shots-other.mjs   (run after refreshing the captures)
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = resolve(ROOT, 'docs/store/screenshots');

// Same 4 crops as make-store-shots.mjs (kept in sync by hand — see that file for
// the Chrome variant). Offsets are 1280×800-normalized pixels; each target below
// rescales them to its own window, so the exact framing shifts slightly per
// target size — that's fine, these just need to show real, in-focus dashboard UI.
const SHOTS = [
  { src: 'dashboard-light.png', top: 0, name: '1-overview-light' },
  { src: 'dashboard-dark.png', top: 0, name: '2-overview-dark' },
  { src: 'dashboard-light.png', top: 560, name: '3-trends-light' },
  { src: 'dashboard-light.png', top: 1380, name: '4-heatmap-light' },
];

// Firefox AMO does not enforce a specific pixel size for listing screenshots
// (unlike Chrome Web Store's strict 1280×800/640×400) — any reasonable size
// displays fine in AMO's carousel, so we reuse Chrome's exact dimensions.
//
// Safari ships via the Mac App Store: App Store Connect requires macOS
// screenshots at one of a fixed set of sizes, of which 1280×800 and 2560×1600
// (both 16:10) are both currently accepted — generate both so either can be
// uploaded directly without further editing.
const TARGETS = [
  { dir: 'firefox', width: 1280, height: 800 },
  { dir: 'safari/1280x800', width: 1280, height: 800 },
  { dir: 'safari/2560x1600', width: 2560, height: 1600 },
];

for (const target of TARGETS) {
  const outDir = resolve(SRC, target.dir);
  mkdirSync(outDir, { recursive: true });
  for (const s of SHOTS) {
    const inPath = resolve(SRC, s.src);
    const meta = await sharp(inPath).metadata();
    // Source may be captured at 1× or 2× — slice the window in source pixels,
    // then resize to the target's exact dimensions (a no-op resize when the
    // source is already native, e.g. the 2560×1600 target from a 2560-wide capture).
    const scale = (meta.width ?? target.width) / target.width;
    const winW = Math.round(target.width * scale);
    const winH = Math.round(target.height * scale);
    const top = Math.min(Math.round(s.top * scale), Math.max(0, (meta.height ?? winH) - winH));
    await sharp(inPath)
      .extract({ left: 0, top, width: winW, height: winH })
      .resize(target.width, target.height, { kernel: 'lanczos3' })
      .removeAlpha()
      .png()
      .toFile(resolve(outDir, `${s.name}.png`));
    console.log(`wrote docs/store/screenshots/${target.dir}/${s.name}.png`);
  }
}
console.log('done');
