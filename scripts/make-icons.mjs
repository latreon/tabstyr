import { readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Single source of truth: the plate-less brand mark (matches components/RingLogo.vue).
// Every icon size is rendered from this one SVG so the toolbar, store, and landing
// favicon all show the identical mark.
const MARK = readFileSync(resolve(ROOT, 'assets/icon.svg'));

// density: render the SVG at high DPI before resize, guaranteeing a >=512px
// source raster regardless of how a given librsvg interprets the viewBox. Every
// target size is then a clean DOWN-scale (crisp), never an up-scale (blurry).
const DENSITY = 512;
const render = (buf, size) =>
  sharp(buf, { density: DENSITY })
    .resize(size, size, { kernel: 'lanczos3', fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 });

// Extension icons (manifest references all of these).
const SIZES = [16, 32, 48, 96, 128, 256, 512];
mkdirSync(resolve(ROOT, 'public/icon'), { recursive: true });
for (const size of SIZES) {
  await render(MARK, size).toFile(resolve(ROOT, `public/icon/${size}.png`));
}
console.log(`extension icons written to public/icon/ (${SIZES.join(',')})`);

// Landing-site favicons — same mark, kept in sync from the same source.
// SVG (crisp at any size, preferred by modern browsers) + 128px PNG fallback.
copyFileSync(resolve(ROOT, 'assets/icon.svg'), resolve(ROOT, 'landing/public/icon.svg'));
await render(MARK, 128).toFile(resolve(ROOT, 'landing/public/icon-128.png'));
console.log('landing favicons written to landing/public/icon.svg + icon-128.png');

// App Store Connect marketing icon for the Safari (Mac App Store) submission —
// 1024×1024, no alpha (Apple requires an opaque app icon; the runtime extension
// icons above stay plate-less/transparent, which only makes sense in a browser
// toolbar). Rendered at 2× density so this, the largest size we ever export,
// is still a clean downscale rather than an upscaled 512px source.
mkdirSync(resolve(ROOT, 'docs/store/safari'), { recursive: true });
await sharp(MARK, { density: DENSITY * 2 })
  .resize(1024, 1024, { kernel: 'lanczos3', fit: 'contain', background: '#ffffff' })
  .flatten({ background: '#ffffff' })
  .png({ compressionLevel: 9 })
  .toFile(resolve(ROOT, 'docs/store/safari/icon-1024.png'));
console.log('App Store Connect icon written to docs/store/safari/icon-1024.png (1024×1024, opaque)');
