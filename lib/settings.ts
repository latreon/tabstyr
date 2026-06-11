import { browser } from 'wxt/browser';
import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  staleDays: 3,
  idleSeconds: 60,
  audioEnabled: true,
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function coerce(raw: unknown): Partial<Settings> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  return {
    ...(typeof r.staleDays === 'number' && { staleDays: clamp(r.staleDays, 1, 60) }),
    ...(typeof r.idleSeconds === 'number' && { idleSeconds: clamp(r.idleSeconds, 15, 600) }),
    ...(typeof r.audioEnabled === 'boolean' && { audioEnabled: r.audioEnabled }),
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
