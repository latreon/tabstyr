import { browser } from 'wxt/browser';
import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  staleDays: 3,
  idleSeconds: 60,
  audioEnabled: true,
};

function coerce(raw: unknown): Partial<Settings> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  return {
    ...(typeof r.staleDays === 'number' && { staleDays: r.staleDays }),
    ...(typeof r.idleSeconds === 'number' && { idleSeconds: r.idleSeconds }),
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
