import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = resolve(ROOT, 'docs/store/promo');
mkdirSync(OUT, { recursive: true });

const SS = 2; // supersample: render at 2× then downscale → crisp text & edges

// Ring-clock mark (same motif as the app icon), drawn at a given center/scale.
function mark(cx, cy, r) {
  const arcStart = `${cx} ${cy - r}`;
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2c2c3a" stroke-width="${r * 0.34}"/>
    <path d="M ${arcStart} A ${r} ${r} 0 1 1 ${cx - r * 0.84} ${cy + r * 0.5}"
      fill="none" stroke="url(#ring)" stroke-width="${r * 0.34}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - r * 0.58}" stroke="#8b8bfa" stroke-width="${r * 0.22}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${cx + r * 0.42}" y2="${cy + r * 0.24}" stroke="#8b8bfa" stroke-width="${r * 0.22}" stroke-linecap="round"/>`;
}

function svg({ w, h, markR, title, titleSize, tagline, taglineSize, layout }) {
  const markCX = layout === 'stacked' ? w / 2 : markR + 70;
  const textX = layout === 'stacked' ? w / 2 : markCX + markR + 56;
  const anchor = layout === 'stacked' ? 'middle' : 'start';

  let markCY, titleY, tagY;
  if (layout === 'stacked') {
    // Lay the icon, title and tagline out as a vertically-centered stack with an
    // explicit gap between the icon and the title. (The old fixed 0.34h / 0.66h
    // positions let the title collide with the icon on the small/large tiles.)
    const gapIconTitle = titleSize * 0.6; // clear vertical space, icon → title
    const titleCap = titleSize * 0.72; // approx cap height of the title text
    const gapTitleTag = titleSize * 0.42; // space between title and tagline
    const tagCap = taglineSize * 0.72;
    const stackH = 2 * markR + gapIconTitle + titleCap + gapTitleTag + tagCap;
    const startY = (h - stackH) / 2;
    markCY = startY + markR; // icon center
    titleY = startY + 2 * markR + gapIconTitle + titleCap; // title baseline
    tagY = titleY + gapTitleTag + tagCap; // tagline baseline
  } else {
    markCY = h / 2;
    titleY = h / 2 - titleSize * 0.1;
    tagY = h / 2 + titleSize * 0.75;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0c0c12"/><stop offset="1" stop-color="#16161f"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="80%">
      <stop offset="0" stop-color="#7c5cf0" stop-opacity="0.28"/><stop offset="1" stop-color="#7c5cf0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#60a5fa"/>
    </linearGradient>
    <linearGradient id="title" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#c4b5fd"/><stop offset="1" stop-color="#93c5fd"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  ${mark(markCX, markCY, markR)}
  <text x="${textX}" y="${titleY}" text-anchor="${anchor}" font-family="Inter, Helvetica, Arial, sans-serif"
    font-size="${titleSize}" font-weight="800" fill="url(#title)" letter-spacing="-1">${title}</text>
  <text x="${textX}" y="${tagY}" text-anchor="${anchor}" font-family="Inter, Helvetica, Arial, sans-serif"
    font-size="${taglineSize}" font-weight="500" fill="#9a9aad">${tagline}</text>
</svg>`;
}

const TAGLINE = 'See how you really use your browser · 100% local';

const assets = [
  { name: 'marquee-1400x560', w: 1400, h: 560, markR: 150, title: 'TabStyr', titleSize: 104, tagline: TAGLINE, taglineSize: 34, layout: 'side' },
  { name: 'small-440x280', w: 440, h: 280, markR: 60, title: 'TabStyr', titleSize: 40, tagline: '100% local time tracker', taglineSize: 17, layout: 'stacked' },
  { name: 'large-920x680', w: 920, h: 680, markR: 130, title: 'TabStyr', titleSize: 84, tagline: TAGLINE, taglineSize: 28, layout: 'stacked' },
];

for (const a of assets) {
  // removeAlpha → 24-bit, no alpha channel. The design is fully opaque (a bg rect
  // covers the canvas), but sharp emits RGBA by default and the Chrome Web Store
  // rejects any alpha channel on promo tiles. Strip it.
  await sharp(Buffer.from(svg(a)), { density: 72 * SS })
    .resize(a.w, a.h, { kernel: 'lanczos3' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT, `${a.name}.png`));
  console.log(`wrote docs/store/promo/${a.name}.png`);
}
