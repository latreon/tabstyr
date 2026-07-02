import { browser } from 'wxt/browser';

// Letter-chip backgrounds (shown when a real favicon is unavailable). Each is dark
// enough that the white letter clears WCAG AA (>=4.5:1), so the fallback stays
// legible on any tile in either theme — the chip carries its own background, so the
// contrast is theme-independent.
export const CHIP_COLORS: readonly string[] = [
  '#6d5cf0', '#3b6fd4', '#1f7a49', '#c0553a',
  '#b83d78', '#2b7f95', '#8a6a2e', '#7a52c8',
];

/**
 * Chromium-only _favicon API (requires the 'favicon' permission).
 * Returns null on non-Chromium runtimes — caller falls back to letterChip.
 */
export function faviconUrl(domain: string): string | null {
  const getURL = browser.runtime?.getURL as ((path: string) => string) | undefined;
  const base = getURL?.('/_favicon/');
  if (!base || !base.startsWith('chrome-extension://')) return null;
  // 64px source for crisp rendering on retina (chip displays at 18px CSS).
  return `${base}?pageUrl=${encodeURIComponent(`https://${domain}/`)}&size=64`;
}

export function letterChip(domain: string): { letter: string; color: string } {
  const letter = (domain[0] ?? '?').toUpperCase();
  let hash = 0;
  for (const ch of domain) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { letter, color: CHIP_COLORS[hash % CHIP_COLORS.length] };
}

// Above this average perceived luminance (0-255, opaque pixels only) a favicon
// counts as "light" — e.g. a white glyph on a transparent background — and would
// vanish on the chip's white tile, so the caller should swap to a dark tile instead.
const LIGHT_ICON_LUMA = 225;

/**
 * Samples a loaded favicon <img> to tell whether it's light enough to disappear
 * on a white tile background. Downsamples to 16x16 and averages perceived
 * luminance over non-transparent pixels only, so a light glyph on a transparent
 * PNG isn't washed out by the surrounding transparency.
 */
export function isLightFavicon(img: HTMLImageElement): boolean {
  try {
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let sum = 0;
    let opaque = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 16) continue; // ignore near-transparent pixels
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      opaque++;
    }
    if (opaque === 0) return false;
    return sum / opaque > LIGHT_ICON_LUMA;
  } catch {
    // getImageData throws on a tainted (cross-origin) canvas — keep the default tile.
    return false;
  }
}
