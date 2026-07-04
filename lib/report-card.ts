// Renders a printable activity-report card onto a <canvas> with the Canvas 2D API —
// no html2canvas, no network — so it stays inside the extension's strict CSP and is
// pixel-deterministic. i18n-free on purpose: the caller passes already-translated
// strings (mirrors lib/wrapped-card.ts). Reuses that module's blob encoder.

export { canvasToImageBlob } from './wrapped-card';

export const REPORT_WIDTH = 1000;
// Content is drawn top-anchored; a full 18-row list ends ~1404px, leaving the
// old 1414 canvas with almost no room underneath. Add a bottom margin (matching
// the side MARGIN) so a full report always has comfortable breathing room below
// the last row. Extra height on a sparse report is just more bottom padding.
const REPORT_BOTTOM_PAD = 72;
export const REPORT_HEIGHT = 1414 + REPORT_BOTTOM_PAD; // ≈ A4 portrait + bottom padding

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
  /** Brand wordmark (e.g. "TabStyr") + tagline, rendered as the footer. */
  brand: string;
  tagline: string;
  /** Match the report to the user's current theme. */
  theme: 'dark' | 'light';
}

const FONT = "'InterVar', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const MARGIN = 72;
// Rows that fit the portrait page with comfortable spacing; caller may pass more
// (we note the remainder under the list).
export const REPORT_MAX_ROWS = 18;
const MAX_ROWS = REPORT_MAX_ROWS;
const ROW_H = 46;

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
  const dark = c.theme === 'dark';
  const bg = dark ? '#1d1d26' : '#ffffff';
  const ink = dark ? '#f4f4f6' : '#16161a';
  const dim = dark ? 'rgba(244,244,246,0.72)' : 'rgba(22,22,26,0.62)';
  const line = dark ? 'rgba(244,244,246,0.18)' : 'rgba(22,22,26,0.12)';
  // Rows read as clear, distinct bands: a firmer fill + a hairline edge.
  const rowTint = dark ? 'rgba(255,255,255,0.08)' : 'rgba(22,22,26,0.055)';
  const rowEdge = dark ? 'rgba(255,255,255,0.12)' : 'rgba(22,22,26,0.09)';
  const W = REPORT_WIDTH;
  const innerW = W - MARGIN * 2;

  // Page.
  ctx.fillStyle = bg;
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
  y += 54;
  ctx.fillStyle = dim;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(c.sitesLabel.toUpperCase(), MARGIN, y);
  // Extra breathing room under the "By site" heading before the first row band.
  let top = y + 26;
  for (const row of c.rows.slice(0, MAX_ROWS)) {
    const cy = top + ROW_H / 2; // vertical centre of the row band
    const baseline = cy + 8; // 22px text baseline that sits visually centered in the band
    // Distinct row band: firmer tint + hairline edge so rows are clearly visible.
    roundRect(ctx, MARGIN - 14, top + 4, innerW + 28, ROW_H - 8, 12);
    ctx.fillStyle = rowTint;
    ctx.fill();
    ctx.strokeStyle = rowEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Category dot with a soft ring so it reads on any tint.
    ctx.fillStyle = row.color;
    ctx.beginPath();
    ctx.arc(MARGIN + 8, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText(fit(ctx, row.label, innerW - 200), MARGIN + 28, baseline);
    ctx.textAlign = 'right';
    ctx.fillStyle = ink; // full-contrast time value
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText(row.value, W - MARGIN, baseline);
    ctx.textAlign = 'left';
    top += ROW_H;
  }
  if (c.moreLabel) {
    ctx.fillStyle = dim;
    ctx.font = `500 20px ${FONT}`;
    ctx.fillText(c.moreLabel, MARGIN, top + 24);
  }
}
