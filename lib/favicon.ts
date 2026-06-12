import { browser } from 'wxt/browser';

export const CHIP_COLORS: readonly string[] = [
  '#7c5cf0', '#5b8def', '#3fb27f', '#d97757',
  '#c95c8e', '#5bb5c9', '#b08d3f', '#8a68d6',
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
