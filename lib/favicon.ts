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
