import { browser } from 'wxt/browser';
import { isCategory, type Category } from './categories';
import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  staleDays: 3,
  idleSeconds: 60,
  audioEnabled: true,
  theme: 'system',
  categoryOverrides: {},
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function sanitizeOverrides(raw: unknown): Record<string, Category> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, Category> = {};
  for (const [domain, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof domain === 'string' && domain && isCategory(value)) out[domain] = value;
  }
  return out;
}

function coerce(raw: unknown): Partial<Settings> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const overrides = sanitizeOverrides(r.categoryOverrides);
  return {
    ...(typeof r.staleDays === 'number' && { staleDays: clamp(r.staleDays, 1, 60) }),
    ...(typeof r.idleSeconds === 'number' && { idleSeconds: clamp(r.idleSeconds, 15, 600) }),
    ...(typeof r.audioEnabled === 'boolean' && { audioEnabled: r.audioEnabled }),
    ...((r.theme === 'system' || r.theme === 'dark' || r.theme === 'light') && { theme: r.theme }),
    ...(overrides && { categoryOverrides: overrides }),
  };
}

export async function getSettings(): Promise<Settings> {
  const { settings } = await browser.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...coerce(settings) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await browser.storage.local.set({ settings: next });
  return next;
}
