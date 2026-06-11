import { browser } from 'wxt/browser';
import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  staleDays: 3,
  idleSeconds: 60,
  audioEnabled: true,
};

export async function getSettings(): Promise<Settings> {
  const { settings } = await browser.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...((settings as Partial<Settings>) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await browser.storage.local.set({ settings: next });
  return next;
}
