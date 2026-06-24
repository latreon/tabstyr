// Renders the shareable "Browsing Wrapped" card straight onto a <canvas> with the
// Canvas 2D API — no html2canvas, no SVG-to-image, no network. That keeps it inside
// the extension's strict CSP (script-src 'self'; connect-src 'none') and makes the
// PNG output deterministic and pixel-identical across browsers.
//
// This module is i18n-free on purpose: the caller passes already-translated strings
// in `WrappedCardContent`, so the drawing code never reaches into vue-i18n and stays
// trivially reusable + testable.

/** Story-format canvas (9:16) — the shape social apps expect for a shared card. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

export interface WrappedCardRow {
  label: string;
  value: string;
  /** Optional favicon-style letter chip drawn at the row's left edge. */
  chip?: { initial: string; color: string };
}

export interface WrappedCardContent {
  heading: string; // e.g. "BROWSING WRAPPED"
  periodLabel: string; // e.g. "Jun 1 – Jun 23 · 38 days"
  /** Persona glyph as SVG path `d` strings on a 24×24 grid (from lib/wrapped-icons). */
  personaIconPaths: readonly string[];
  personaIconFilled?: boolean;
  personaTitle: string; // e.g. "The Builder"
  bigValue: string; // e.g. "12h 30m"
  bigCaption: string; // e.g. "total active browsing"
  rows: WrappedCardRow[]; // 3–4 highlight rows
  footer: string; // e.g. "TabStyr · 0 bytes leave your device"
  /** Two hex stops for the background gradient (persona accent → deep). */
  accentA: string;
  accentB: string;
  /** Card surface tone. */
  theme: 'dark' | 'light';
}

const FONT_STACK = "'InterVar', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Trim `text` with an ellipsis so it fits within `maxWidth` at the current font. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + ellipsis).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo) + ellipsis : ellipsis;
}

/**
 * Paint the full card onto `canvas`. Sizes the backing store to CARD_WIDTH×CARD_HEIGHT
 * times `scale` (use 2 for crisp retina/PNG output) while drawing in logical units.
 * A no-op if the 2D context is unavailable (e.g. a headless test environment).
 */
export function renderWrappedCard(canvas: HTMLCanvasElement, content: WrappedCardContent, scale = 2): void {
  canvas.width = CARD_WIDTH * scale;
  canvas.height = CARD_HEIGHT * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  try {
    paint(ctx, content, scale);
  } catch {
    // A canvas draw should never crash the page — bail quietly if the host's 2D
    // context is incomplete (e.g. a headless test stub).
  }
}

function paint(ctx: CanvasRenderingContext2D, content: WrappedCardContent, scale: number): void {
  ctx.scale(scale, scale);
  ctx.textBaseline = 'alphabetic';

  const dark = content.theme === 'dark';
  const ink = dark ? '#ffffff' : '#16161a';
  const inkDim = dark ? 'rgba(255,255,255,0.66)' : 'rgba(22,22,26,0.58)';
  const panel = dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)';
  const panelBorder = dark ? 'rgba(255,255,255,0.16)' : 'rgba(22,22,26,0.08)';
  const cx = CARD_WIDTH / 2;

  // ── Background: diagonal accent gradient, soft top glow, bottom vignette ────
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, content.accentA);
  bg.addColorStop(1, content.accentB);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const glow = ctx.createRadialGradient(cx, 360, 60, cx, 360, 980);
  glow.addColorStop(0, dark ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.5)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const vignette = ctx.createLinearGradient(0, CARD_HEIGHT - 520, 0, CARD_HEIGHT);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, dark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.12)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, CARD_HEIGHT - 520, CARD_WIDTH, 520);

  // Translucent content slab keeps text legible over any gradient.
  const slabX = 64;
  const slabW = CARD_WIDTH - slabX * 2;
  const slabY = 72;
  const slabH = CARD_HEIGHT - slabY * 2;
  ctx.fillStyle = dark ? 'rgba(10,10,16,0.30)' : 'rgba(255,255,255,0.28)';
  roundRect(ctx, slabX, slabY, slabW, slabH, 64);
  ctx.fill();
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, slabX, slabY, slabW, slabH, 64);
  ctx.stroke();

  ctx.textAlign = 'center';

  // ── Header ──────────────────────────────────────────────────────────────
  ctx.fillStyle = ink;
  ctx.font = `800 40px ${FONT_STACK}`;
  ctx.fillText(spaced(content.heading.toUpperCase()), cx, 196);
  ctx.fillStyle = inkDim;
  ctx.font = `600 31px ${FONT_STACK}`;
  ctx.fillText(fitText(ctx, content.periodLabel, slabW - 96), cx, 248);

  // ── Persona ring + glyph ──────────────────────────────────────────────────
  const ringY = 408;
  const ringR = 94;
  ctx.beginPath();
  ctx.arc(cx, ringY, ringR, 0, Math.PI * 2);
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.5)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.42)' : 'rgba(22,22,26,0.18)';
  ctx.stroke();
  drawIcon(ctx, content.personaIconPaths, content.personaIconFilled ?? false, cx, ringY, 96, ink);

  // ── Persona title ─────────────────────────────────────────────────────────
  ctx.fillStyle = ink;
  ctx.font = `800 72px ${FONT_STACK}`;
  ctx.fillText(fitText(ctx, content.personaTitle, slabW - 80), cx, 600);

  // ── Hero number + caption ──────────────────────────────────────────────────
  ctx.fillStyle = ink;
  ctx.font = `900 150px ${FONT_STACK}`;
  ctx.fillText(fitText(ctx, content.bigValue, slabW - 48), cx, 760);
  ctx.fillStyle = inkDim;
  ctx.font = `600 32px ${FONT_STACK}`;
  ctx.fillText(spaced(content.bigCaption.toUpperCase()), cx, 814);

  // ── Highlight rows ───────────────────────────────────────────────────────
  const rows = content.rows.slice(0, 4);
  const rowH = 148;
  const gap = 22;
  const rowsX = slabX + 48;
  const rowsW = slabW - 96;
  const padX = 44;
  let y = 904;
  for (const row of rows) {
    ctx.fillStyle = panel;
    roundRect(ctx, rowsX, y, rowsW, rowH, 30);
    ctx.fill();
    ctx.strokeStyle = panelBorder;
    ctx.lineWidth = 2;
    roundRect(ctx, rowsX, y, rowsW, rowH, 30);
    ctx.stroke();

    // Optional favicon-style chip at the row's left edge; text shifts right of it.
    let textX = rowsX + padX;
    if (row.chip) {
      const cs = 72;
      const chipY = y + (rowH - cs) / 2;
      ctx.fillStyle = row.chip.color;
      roundRect(ctx, textX, chipY, cs, cs, 18);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 38px ${FONT_STACK}`;
      ctx.textAlign = 'center';
      ctx.fillText(row.chip.initial, textX + cs / 2, chipY + cs / 2 + 13);
      textX += cs + 26;
    }
    const textW = rowsW - (textX - rowsX) - padX;

    ctx.textAlign = 'left';
    ctx.fillStyle = inkDim;
    ctx.font = `700 27px ${FONT_STACK}`;
    ctx.fillText(fitText(ctx, row.label.toUpperCase(), textW), textX, y + 54);
    ctx.fillStyle = ink;
    ctx.font = `800 50px ${FONT_STACK}`;
    ctx.fillText(fitText(ctx, row.value, textW), textX, y + 110);
    y += rowH + gap;
  }

  // ── Footer: divider + centered wordmark ─────────────────────────────────────
  const footY = CARD_HEIGHT - 132;
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.18)' : 'rgba(22,22,26,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 70, footY - 56);
  ctx.lineTo(cx + 70, footY - 56);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.font = `700 29px ${FONT_STACK}`;
  ctx.fillText(fitText(ctx, content.footer, slabW - 80), cx, footY);
}

/** "ABC" → "A B C" — poor-man's letter-spacing for the heading (canvas has no
 * letterSpacing in older engines, and this stays portable). */
function spaced(text: string): string {
  return text.split('').join('  ');
}

/** Draw a 24×24-grid line icon centered at (cx, cy), scaled to `size`px, using
 * Path2D so the share-card glyph matches the on-screen SVG exactly. */
function drawIcon(
  ctx: CanvasRenderingContext2D,
  paths: readonly string[],
  filled: boolean,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  if (typeof Path2D === 'undefined') return; // headless/test stub — skip glyph
  const s = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.6; // in 24-unit space → ~size/15 px visual stroke
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const d of paths) {
    const p = new Path2D(d);
    if (filled) ctx.fill(p);
    else ctx.stroke(p);
  }
  ctx.restore();
}

/**
 * Encode the canvas as an image Blob. Defaults to JPEG q0.9 — the card is fully
 * opaque (a gradient fills every pixel), so JPEG needs no alpha and is ~10× smaller
 * than the lossless PNG at this resolution while staying visually crisp and
 * universally shareable. Resolves null if encoding fails.
 */
export function canvasToImageBlob(
  canvas: HTMLCanvasElement,
  type = 'image/jpeg',
  quality = 0.9,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } catch {
      resolve(null);
    }
  });
}
