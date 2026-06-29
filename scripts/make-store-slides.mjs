// Build the Chrome/Edge/Firefox store carousel slides — branded 1280×800 tiles
// that pair a headline with the REAL app UI (composited from the captured
// screenshots, so nothing shown is fake). Run after `npm run e2e` has refreshed
// docs/store/screenshots/*. Output → docs/store/slides/*.png (24-bit, no alpha).
//
//   node scripts/make-store-slides.mjs
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SHOTS = resolve(ROOT, 'docs/store/screenshots');
const PH = resolve(ROOT, 'docs/store/producthunt/screenshots');
const OUT = resolve(ROOT, 'docs/store/slides');
mkdirSync(OUT, { recursive: true });

const W = 1280;
const H = 800;
const SS = 2; // supersample: render at 2× then downscale → crisp text & edges
const FONT = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";

// ---- shared SVG fragments -------------------------------------------------

// Brand defs + dark background with a soft purple glow up top. Every slide
// opens with this so the deck reads as one set.
const DEFS = `
  <linearGradient id="bg" x1="0" y1="0" x2="0.5" y2="1">
    <stop offset="0" stop-color="#0a0a12"/><stop offset="1" stop-color="#111119"/>
  </linearGradient>
  <radialGradient id="bloomA" cx="50%" cy="-5%" r="70%">
    <stop offset="0" stop-color="#8b5cf6" stop-opacity="0.40"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="bloomB" cx="88%" cy="108%" r="62%">
    <stop offset="0" stop-color="#3b82f6" stop-opacity="0.24"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vignette" cx="50%" cy="42%" r="78%">
    <stop offset="0.55" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.45"/>
  </radialGradient>
  <linearGradient id="ring" x1="0.1" y1="0" x2="0.95" y2="1">
    <stop offset="0" stop-color="#c4b5fd"/><stop offset="0.5" stop-color="#a78bfa"/><stop offset="1" stop-color="#60a5fa"/>
  </linearGradient>
  <linearGradient id="title" x1="0" y1="0" x2="1" y2="0.2">
    <stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#f1ebff"/><stop offset="1" stop-color="#c9b6ff"/>
  </linearGradient>
  <radialGradient id="iconGlow" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#7c5cf0" stop-opacity="0.50"/><stop offset="1" stop-color="#7c5cf0" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="panelGlow" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#7c5cf0" stop-opacity="0.30"/><stop offset="1" stop-color="#7c5cf0" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="cardface" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.09"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.02"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
  </linearGradient>
  <filter id="grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/>
    <feColorMatrix in="n" type="saturate" values="0"/>
  </filter>
  <filter id="cardshadow" x="-40%" y="-40%" width="180%" height="180%">
    <feDropShadow dx="0" dy="30" stdDeviation="46" flood-color="#000000" flood-opacity="0.55"/>
  </filter>`;

// Layered, modern background: deep base + two soft colour blooms + vignette +
// a faint monochrome grain so large flat areas don't look plasticky.
const bgRects = `
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#bloomA)"/>
  <rect width="${W}" height="${H}" fill="url(#bloomB)"/>
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.045"/>`;

// Eyebrow pill: small uppercase label with a leading dot.
// Width is derived from the label with an intentionally generous per-char
// estimate (13px/700 uppercase + 1.5 letter-spacing) plus explicit left/right
// padding, so the text never crowds or clips the pill's right edge.
function eyebrow(x, y, text, anchor = 'start') {
  const padL = 18, padR = 24, h = 36, dot = 5, gap = 13;
  const CHAR = 9.7; // conservative advance for uppercase + letter-spacing
  const textW = text.length * CHAR;
  const lead = padL + dot * 2 + gap; // left edge → text start
  const tw = Math.round(lead + textW + padR);
  const rectX = Math.round(anchor === 'middle' ? x - tw / 2 : x);
  const dotCx = rectX + padL + dot;
  const textX = dotCx + dot + gap;
  return `
    <rect x="${rectX}" y="${y}" width="${tw}" height="${h}" rx="${h / 2}" fill="#ffffff" fill-opacity="0.06" stroke="#ffffff" stroke-opacity="0.12"/>
    <circle cx="${dotCx}" cy="${y + h / 2}" r="${dot}" fill="#a78bfa"/>
    <text x="${textX}" y="${y + h / 2 + 4.5}" font-family="${FONT}" font-size="13" font-weight="700" letter-spacing="1.5" fill="#c9c4e0">${text}</text>`;
}

// Feature chip (icon-dot + label). Width is derived from the label so text
// never clips. Use chipRow()/chipRowCentered() to lay several out.
const CHIP_H = 46;
const chipWidth = (label) => Math.round(42 + label.length * 9.2 + 24);

function chip(x, y, label, color) {
  const w = chipWidth(label);
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${CHIP_H}" rx="12" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.10"/>
    <circle cx="${x + 24}" cy="${y + CHIP_H / 2}" r="6" fill="${color}"/>
    <text x="${x + 42}" y="${y + CHIP_H / 2 + 5.5}" font-family="${FONT}" font-size="17" font-weight="600" fill="#e7e5f2">${label}</text>`;
}

// Lay chips left-to-right starting at x.
function chipRow(x, y, items, gap = 14) {
  let cx = x, out = '';
  for (const it of items) { out += chip(cx, y, it.label, it.color); cx += chipWidth(it.label) + gap; }
  return out;
}

// Lay chips as a horizontally-centred row around cx.
function chipRowCentered(cx, y, items, gap = 14) {
  const total = items.reduce((s, it) => s + chipWidth(it.label), 0) + gap * (items.length - 1);
  return chipRow(cx - total / 2, y, items, gap);
}

// Window chrome (3 dots) drawn into the card panel; the screenshot sits below.
function windowPanel(x, y, w, h, bar = 40) {
  return `
    <ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w * 0.62}" ry="${h * 0.7}" fill="url(#panelGlow)"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#101019" filter="url(#cardshadow)"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="url(#cardface)"/>
    <circle cx="${x + 22}" cy="${y + bar / 2}" r="6" fill="#ff5f57"/>
    <circle cx="${x + 42}" cy="${y + bar / 2}" r="6" fill="#febc2e"/>
    <circle cx="${x + 62}" cy="${y + bar / 2}" r="6" fill="#28c840"/>`;
}

// Hairline border overlay (composited on top of the screenshot so the card edge
// stays crisp). Transparent except the stroke.
// Crisp hairline card border. Returns a card-sized (SS-scaled) overlay that the
// caller positions with left/top — kept smaller than the base canvas.
function borderOverlay(w, h, r = 18) {
  const s = SS;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * s}" height="${h * s}">
    <rect x="${0.6 * s}" y="${0.6 * s}" width="${(w - 1.2) * s}" height="${(h - 1.2) * s}" rx="${r * s}" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="${1.2 * s}"/></svg>`;
}

function svgDoc(body) {
  // Logical size + viewBox; write() rasterises this at density 72·SS so the base
  // canvas comes out at SS resolution (sharp scales a viewBox SVG by density).
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${DEFS}</defs>
  ${bgRects}
  ${body}
</svg>`;
}

// ---- screenshot helpers ---------------------------------------------------

// Rounded-rect alpha mask. `corners` = [tl,tr,br,bl] radii.
function maskSvg(w, h, [tl, tr, br, bl]) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <path d="M ${tl} 0 H ${w - tr} A ${tr} ${tr} 0 0 1 ${w} ${tr} V ${h - br} A ${br} ${br} 0 0 1 ${w - br} ${h} H ${bl} A ${bl} ${bl} 0 0 1 0 ${h - bl} V ${tl} A ${tl} ${tl} 0 0 1 ${tl} 0 Z" fill="#fff"/>
    </svg>`,
  );
}

// Load a screenshot (path or buffer), resize to w×h (at SS), round its corners.
async function shot(src, w, h, corners, { position = 'top' } = {}) {
  const base = typeof src === 'string' ? sharp(resolve(ROOT, src)) : sharp(src);
  const sw = Math.round(w * SS), sh = Math.round(h * SS);
  return base
    .resize(sw, sh, { fit: 'cover', position })
    .composite([{ input: maskSvg(sw, sh, corners.map((c) => c * SS)), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function write(name, body, layers) {
  // Rasterise the base SVG at SS resolution, composite each SS-sized layer (their
  // offsets scaled to match) one at a time, then downscale to the final 1280×800.
  // Sequential compositing avoids a sharp quirk with multiple large inputs.
  let buf = await sharp(Buffer.from(svgDoc(body)), { density: 72 * SS }).png().toBuffer();
  for (const l of layers) {
    const layer = l.left != null || l.top != null
      ? { ...l, left: Math.round((l.left || 0) * SS), top: Math.round((l.top || 0) * SS) }
      : l;
    buf = await sharp(buf).composite([layer]).png().toBuffer();
  }
  await sharp(buf)
    .resize(W, H, { kernel: 'lanczos3' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT, `${name}.png`));
  console.log(`wrote docs/store/slides/${name}.png`);
}

// Full-dashboard (1280×800, ratio 1.6) screenshot shown undistorted in a window
// panel under a centred title + subtitle. Shared by every "real UI" slide so the
// deck stays consistent.
async function panelSlide(name, src, title, subtitle, { position = 'top' } = {}) {
  const bar = 40, iw = 864, ih = 540; // 1.6 ratio → no distortion
  const cardW = iw, cardH = ih + bar;
  const cx = (W - cardW) / 2, cy = 176;
  const body = `
    <text x="${W / 2}" y="98" text-anchor="middle" font-family="${FONT}" font-size="48" font-weight="800" letter-spacing="-1.2" fill="url(#title)">${title}</text>
    <text x="${W / 2}" y="140" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="500" fill="#a7a5bd">${subtitle}</text>
    ${windowPanel(cx, cy, cardW, cardH, bar)}`;
  const img = await shot(src, iw, ih, [0, 0, 18, 18], { position });
  await write(name, body, [
    { input: img, left: cx, top: cy + bar },
    { input: Buffer.from(borderOverlay(cardW, cardH, 18)), left: cx, top: cy },
  ]);
}

// ---- feature-bento glyphs + card -----------------------------------------
// Small mark drawn inside a tinted rounded tile, one per feature card.
function glyphTile(cx, cy, accent, inner) {
  const s = 30;
  return `<rect x="${cx - s}" y="${cy - s}" width="${s * 2}" height="${s * 2}" rx="15" fill="${accent}" fill-opacity="0.15"/>${inner}`;
}
const gClock = (cx, cy, a) => glyphTile(cx, cy, a, `
  <circle cx="${cx}" cy="${cy}" r="15" fill="none" stroke="${a}" stroke-width="3.4"/>
  <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 9}" stroke="${a}" stroke-width="3.2" stroke-linecap="round"/>
  <line x1="${cx}" y1="${cy}" x2="${cx + 7}" y2="${cy + 3}" stroke="${a}" stroke-width="3.2" stroke-linecap="round"/>`);
const gHeat = (cx, cy, a) => {
  let cells = '';
  const o = [0.25, 0.5, 1, 0.5, 1, 0.4, 1, 0.35, 0.6];
  for (let i = 0; i < 9; i++) {
    const gx = cx - 16 + (i % 3) * 12, gy = cy - 16 + Math.floor(i / 3) * 12;
    cells += `<rect x="${gx}" y="${gy}" width="9" height="9" rx="2" fill="${a}" fill-opacity="${o[i]}"/>`;
  }
  return glyphTile(cx, cy, a, cells);
};
const gFocus = (cx, cy, a) => glyphTile(cx, cy, a, `
  <circle cx="${cx}" cy="${cy}" r="15" fill="none" stroke="${a}" stroke-opacity="0.3" stroke-width="3.6"/>
  <path d="M ${cx} ${cy - 15} A 15 15 0 1 1 ${cx - 13} ${cy + 7.5}" fill="none" stroke="${a}" stroke-width="3.6" stroke-linecap="round"/>`);
const gShield = (cx, cy, a) => glyphTile(cx, cy, a, `
  <path d="M ${cx} ${cy - 16} L ${cx + 13} ${cy - 9} V ${cy + 3} C ${cx + 13} ${cy + 11} ${cx + 7} ${cy + 16} ${cx} ${cy + 18} C ${cx - 7} ${cy + 16} ${cx - 13} ${cy + 11} ${cx - 13} ${cy + 3} V ${cy - 9} Z" fill="none" stroke="${a}" stroke-width="3"/>
  <path d="M ${cx - 6} ${cy + 1} L ${cx - 1.5} ${cy + 6} L ${cx + 7} ${cy - 5}" fill="none" stroke="${a}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`);

function featureCard(x, y, w, h, c) {
  const icx = x + 60, icy = y + h / 2, tx = x + 112;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="#13131d" filter="url(#cardshadow)"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="url(#cardface)"/>
    <rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="22" fill="none" stroke="#ffffff" stroke-opacity="0.10"/>
    ${c.glyph(icx, icy, c.accent)}
    <text x="${tx}" y="${y + h / 2 - 6}" font-family="${FONT}" font-size="26" font-weight="700" fill="#f3f1fb">${c.title}</text>
    <text x="${tx}" y="${y + h / 2 + 24}" font-family="${FONT}" font-size="17" font-weight="500" fill="#a7a5bd">${c.desc}</text>`;
}

// ---- slides ---------------------------------------------------------------

async function slideFeatures() {
  const cards = [
    { accent: '#a78bfa', glyph: gClock, title: 'Automatic tracking', desc: 'Active time per site — no timers to start.' },
    { accent: '#60a5fa', glyph: gHeat, title: 'Hourly heatmap', desc: 'See exactly when you browse most.' },
    { accent: '#34d399', glyph: gFocus, title: 'Focus score', desc: 'Productive vs distracting, every day.' },
    { accent: '#f472b6', glyph: gShield, title: '100% local', desc: 'No servers. No accounts. No tracking.' },
  ];
  const cw = 496, ch = 196, gap = 32;
  const sx = (W - (cw * 2 + gap)) / 2, sy = 230;
  const pos = [[sx, sy], [sx + cw + gap, sy], [sx, sy + ch + gap], [sx + cw + gap, sy + ch + gap]];
  let body = `
    ${eyebrow(W / 2, 92, 'WHY TABSTYR', 'middle')}
    <text x="${W / 2}" y="184" text-anchor="middle" font-family="${FONT}" font-size="52" font-weight="800" letter-spacing="-1.4" fill="url(#title)">Everything you need. Nothing you don’t.</text>`;
  cards.forEach((c, i) => { body += featureCard(pos[i][0], pos[i][1], cw, ch, c); });
  await write('2-features', body, []);
}

async function slideCompare() {
  return panelSlide(
    '7-compare',
    await dashSection(1080),
    'Compare week to week.',
    'See which categories grew or shrank — and the exact hours behind the change.',
  );
}

async function slide1Hero() {
  const cx = W / 2;
  // Use the REAL extension icon (the plate-less brand ring) so the hero logo is
  // identical to the toolbar / store icon — not a separate hand-drawn mark.
  const ICON = 188;
  const iconImg = await sharp(resolve(ROOT, 'public/icon/512.png'))
    .resize(ICON * SS, ICON * SS, { kernel: 'lanczos3' })
    .png()
    .toBuffer();
  const iconTop = 236;
  const iconCy = iconTop + ICON / 2;
  const body = `
    ${eyebrow(cx, 162, 'PRODUCTIVITY · BROWSER EXTENSION', 'middle')}
    <circle cx="${cx}" cy="${iconCy}" r="158" fill="url(#iconGlow)"/>
    <text x="${cx}" y="506" text-anchor="middle" font-family="${FONT}" font-size="96" font-weight="800" letter-spacing="-2" fill="url(#title)">TabStyr</text>
    <text x="${cx}" y="558" text-anchor="middle" font-family="${FONT}" font-size="29" font-weight="500" fill="#a7a5bd">See how you really spend your time online.</text>
    ${chipRowCentered(cx, 618, [
      { label: 'Automatic time tracking', color: '#a78bfa' },
      { label: 'Hourly heatmap', color: '#60a5fa' },
      { label: '100% local — 0 bytes leave', color: '#34d399' },
    ])}`;
  await write('1-hero', body, [{ input: iconImg, left: Math.round(cx - ICON / 2), top: iconTop }]);
}

async function slide2Popup() {
  // Split: copy left, real popup (360×620) floated right (native ratio, padded
  // so the card never runs off the canvas).
  const ph = 600, pw = Math.round((360 / 620) * ph);
  const px = W - 64 - 8 - pw, py = (H - ph) / 2;
  const tx = 96;
  const body = `
    ${eyebrow(tx, 196, 'ONE CLICK · EVERY TAB')}
    <text x="${tx}" y="320" font-family="${FONT}" font-size="62" font-weight="800" letter-spacing="-1.5" fill="url(#title)">Where did</text>
    <text x="${tx}" y="392" font-family="${FONT}" font-size="62" font-weight="800" letter-spacing="-1.5" fill="url(#title)">the day go?</text>
    <text x="${tx}" y="452" font-family="${FONT}" font-size="24" font-weight="500" fill="#a7a5bd">Open the popup for today’s active time and</text>
    <text x="${tx}" y="484" font-family="${FONT}" font-size="24" font-weight="500" fill="#a7a5bd">your top sites — ranked, the moment you look.</text>
    ${chipRow(tx, 552, [
      { label: 'Active time today', color: '#a78bfa' },
      { label: 'vs weekly average', color: '#60a5fa' },
    ])}
    <ellipse cx="${px + pw / 2}" cy="${py + ph / 2}" rx="${pw * 0.9}" ry="${ph * 0.62}" fill="url(#panelGlow)"/>
    <rect x="${px - 8}" y="${py - 8}" width="${pw + 16}" height="${ph + 16}" rx="28" fill="#101019" filter="url(#cardshadow)"/>
    <rect x="${px - 8}" y="${py - 8}" width="${pw + 16}" height="${ph + 16}" rx="28" fill="url(#cardface)"/>`;
  const img = await shot('docs/store/screenshots/popup-dark.png', pw, ph, [22, 22, 22, 22], { position: 'top' });
  await write('3-popup', body, [
    { input: img, left: px, top: py },
    { input: Buffer.from(borderOverlay(pw + 16, ph + 16, 28)), left: px - 8, top: py - 8 },
  ]);
}

const slide3Dashboard = () =>
  panelSlide(
    '4-dashboard',
    'docs/store/screenshots/chrome/2-overview-dark.png',
    'Your whole day, at a glance.',
    'Today, time by category, focus score, and top sites — one dashboard.',
  );

// Slice a 1280×800 section from the tall dark dashboard capture (auto-scaling if
// the capture is 2×) — for slides whose UI lives on the dashboard page, so they
// inherit the retina capture instead of a 1× Product Hunt still.
async function dashSection(top1x) {
  const src = resolve(SHOTS, 'dashboard-dark.png');
  const meta = await sharp(src).metadata();
  const sc = (meta.width ?? 1280) / 1280;
  const winH = Math.round(800 * sc);
  const maxTop = Math.max(0, (meta.height ?? winH) - winH);
  return sharp(src)
    .extract({ left: 0, top: Math.min(Math.round(top1x * sc), maxTop), width: Math.round(1280 * sc), height: winH })
    .png()
    .toBuffer();
}

async function slideTrends() {
  return panelSlide(
    '5-trends',
    await dashSection(560),
    'Watch your week take shape.',
    'Daily and weekly trends show whether your time is trending up — or slipping away.',
  );
}

const slideDetail = () =>
  panelSlide(
    '8-detail',
    'docs/store/producthunt/screenshots/modal-domain-dark.png',
    'Drill into any site.',
    'Tap a domain for the full picture: when you visit, how long, and how it trends.',
  );

async function slideWorklog() {
  return panelSlide(
    '9-worklog',
    await dashSection(1820),
    'Turn browsing into a work log.',
    'Review focused sessions and tune what counts — all from one place.',
  );
}

async function slide4Heatmap() {
  // Extract just the ACTIVITY HEATMAP panel from the tall dark dashboard capture.
  // Coords are authored for a 1280-wide source; scale them if the capture is 2×.
  const heatSrc = resolve(SHOTS, 'dashboard-dark.png');
  const heatMeta = await sharp(heatSrc).metadata();
  const hScale = (heatMeta.width ?? 1280) / 1280;
  const heat = await sharp(heatSrc)
    .extract({
      left: 0,
      top: Math.round(1418 * hScale),
      width: Math.round(1280 * hScale),
      height: Math.round(420 * hScale),
    })
    .png()
    .toBuffer();
  const bar = 40, iw = 1000, ih = Math.round((415 / 1280) * iw); // native ratio
  const cardW = iw, cardH = ih + bar;
  const cx = (W - cardW) / 2;
  const cy = 250;
  const body = `
    <text x="${W / 2}" y="120" text-anchor="middle" font-family="${FONT}" font-size="50" font-weight="800" letter-spacing="-1.2" fill="url(#title)">Spot your patterns.</text>
    <text x="${W / 2}" y="160" text-anchor="middle" font-family="${FONT}" font-size="23" font-weight="500" fill="#a7a5bd">An hourly heatmap shows exactly which hours of which days you browse most.</text>
    ${windowPanel(cx, cy, cardW, cardH, bar)}`;
  const img = await shot(heat, iw, ih, [0, 0, 18, 18], { position: 'top' });
  await write('6-heatmap', body, [
    { input: img, left: cx, top: cy + bar },
    { input: Buffer.from(borderOverlay(cardW, cardH, 18)), left: cx, top: cy },
  ]);
}

async function slide5Privacy() {
  const cx = W / 2;
  // Shield mark with a check.
  const sx = cx, sy = 300, s = 78;
  const shield = `
    <path d="M ${sx} ${sy - s} L ${sx + s * 0.82} ${sy - s * 0.55} V ${sy + s * 0.18}
      C ${sx + s * 0.82} ${sy + s * 0.72} ${sx + s * 0.42} ${sy + s * 1.02} ${sx} ${sy + s * 1.12}
      C ${sx - s * 0.42} ${sy + s * 1.02} ${sx - s * 0.82} ${sy + s * 0.72} ${sx - s * 0.82} ${sy + s * 0.18}
      V ${sy - s * 0.55} Z" fill="none" stroke="url(#ring)" stroke-width="7" stroke-linejoin="round"/>
    <path d="M ${sx - s * 0.34} ${sy + s * 0.06} L ${sx - s * 0.06} ${sy + s * 0.34} L ${sx + s * 0.42} ${sy - s * 0.26}"
      fill="none" stroke="#34d399" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
  const body = `
    ${eyebrow(cx, 150, 'PRIVATE BY DESIGN', 'middle')}
    ${shield}
    <text x="${cx}" y="520" text-anchor="middle" font-family="${FONT}" font-size="62" font-weight="800" letter-spacing="-1.5" fill="url(#title)">0 bytes leave your device.</text>
    <text x="${cx}" y="566" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="500" fill="#a7a5bd">Stored in your browser. No servers, no accounts, no ads, no tracking.</text>
    ${chipRowCentered(cx, 626, [
      { label: 'Stays on-device', color: '#34d399' },
      { label: 'Encrypted backups', color: '#a78bfa' },
      { label: 'No page content', color: '#60a5fa' },
      { label: 'Open source', color: '#f472b6' },
    ])}`;
  await write('10-privacy', body, []);
}

await slide1Hero();
await slideFeatures();
await slide2Popup();
await slide3Dashboard();
await slideTrends();
await slide4Heatmap();
await slideCompare();
await slideDetail();
await slideWorklog();
await slide5Privacy();
console.log('done — 10 slides in docs/store/slides/');
