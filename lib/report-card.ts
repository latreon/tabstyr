// Renders a printable activity-report card onto a <canvas> with the Canvas 2D API —
// no html2canvas, no network — so it stays inside the extension's strict CSP and is
// pixel-deterministic. i18n-free on purpose: the caller passes already-translated
// strings (mirrors lib/wrapped-card.ts). Reuses that module's blob encoder.

export { canvasToImageBlob } from './wrapped-card';

export const REPORT_WIDTH = 1000;
export const REPORT_HEIGHT = 1414; // ~A4 portrait ratio

export interface ReportCardCategory {
  label: string;
  pct: number; // 0–100 share of total
  color: string;
}
export interface ReportCardRow {
  label: string; // domain
  value: string; // formatted duration
  color: string; // category color dot
}
export interface ReportCardContent {
  heading: string;
  periodLabel: string;
  totalLabel: string;
  totalValue: string;
  categoryLabel: string;
  categories: ReportCardCategory[];
  sitesLabel: string;
  rows: ReportCardRow[];
  /** Shown under the site list when rows were truncated (empty = nothing hidden). */
  moreLabel: string;
  footer: string;
}

const FONT = "'InterVar', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const MARGIN = 72;
// Rows that fit the portrait page; caller may pass more (we note the remainder).
export const REPORT_MAX_ROWS = 26;
const MAX_ROWS = REPORT_MAX_ROWS;

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

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo) + '…' : '…';
}

/** Paint the report onto `canvas` at `scale` (2 = crisp PNG). No-op without a 2D ctx. */
export function renderReportCard(canvas: HTMLCanvasElement, content: ReportCardContent, scale = 2): void {
  canvas.width = REPORT_WIDTH * scale;
  canvas.height = REPORT_HEIGHT * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  try {
    paint(ctx, content, scale);
  } catch {
    /* never let a draw crash the page */
  }
}

function paint(ctx: CanvasRenderingContext2D, c: ReportCardContent, scale: number): void {
  ctx.scale(scale, scale);
  const ink = '#16161a';
  const dim = 'rgba(22,22,26,0.55)';
  const line = 'rgba(22,22,26,0.10)';
  const W = REPORT_WIDTH;
  const innerW = W - MARGIN * 2;

  // Page.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, REPORT_HEIGHT);

  // Header.
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = ink;
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText(fit(ctx, c.heading, innerW), MARGIN, 110);
  ctx.fillStyle = dim;
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText(fit(ctx, c.periodLabel, innerW), MARGIN, 150);

  // Total block.
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN, 186);
  ctx.lineTo(W - MARGIN, 186);
  ctx.stroke();
  ctx.fillStyle = dim;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(c.totalLabel.toUpperCase(), MARGIN, 240);
  ctx.fillStyle = ink;
  ctx.font = `900 84px ${FONT}`;
  ctx.fillText(fit(ctx, c.totalValue, innerW), MARGIN, 320);

  // Category stacked bar + legend.
  let y = 392;
  ctx.fillStyle = dim;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(c.categoryLabel.toUpperCase(), MARGIN, y);
  y += 24;
  const barH = 22;
  let x = MARGIN;
  for (const cat of c.categories) {
    const w = Math.max(0, (innerW * cat.pct) / 100);
    ctx.fillStyle = cat.color;
    ctx.fillRect(x, y, w, barH);
    x += w;
  }
  y += barH + 34;
  ctx.font = `600 20px ${FONT}`;
  let lx = MARGIN;
  for (const cat of c.categories) {
    const label = `${cat.label} ${cat.pct}%`;
    const chipW = 18 + ctx.measureText(label).width + 26;
    if (lx + chipW > W - MARGIN) {
      lx = MARGIN;
      y += 30;
    }
    ctx.fillStyle = cat.color;
    ctx.beginPath();
    ctx.arc(lx + 6, y - 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dim;
    ctx.fillText(label, lx + 20, y);
    lx += chipW;
  }

  // Site list.
  y += 48;
  ctx.fillStyle = dim;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(c.sitesLabel.toUpperCase(), MARGIN, y);
  y += 30;
  const rowH = 40;
  for (const row of c.rows.slice(0, MAX_ROWS)) {
    ctx.fillStyle = row.color;
    ctx.beginPath();
    ctx.arc(MARGIN + 6, y - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    ctx.font = `500 22px ${FONT}`;
    ctx.fillText(fit(ctx, row.label, innerW - 200), MARGIN + 24, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = dim;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(row.value, W - MARGIN, y);
    ctx.textAlign = 'left';
    y += rowH;
  }
  if (c.moreLabel) {
    ctx.fillStyle = dim;
    ctx.font = `500 20px ${FONT}`;
    ctx.fillText(c.moreLabel, MARGIN + 24, y + 4);
  }

  // Footer.
  ctx.textAlign = 'center';
  ctx.fillStyle = dim;
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText(fit(ctx, c.footer, innerW), W / 2, REPORT_HEIGHT - 56);
}
