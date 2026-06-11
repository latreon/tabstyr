import { beforeEach, describe, expect, test } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '@/lib/settings';

describe('settings', () => {
  beforeEach(() => fakeBrowser.reset());

  test('returns defaults when nothing stored', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test('saveSettings merges a patch and persists', async () => {
    await saveSettings({ staleDays: 7 });
    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, staleDays: 7 });
  });

  test('partial stored value is backfilled with defaults', async () => {
    await fakeBrowser.storage.local.set({ settings: { idleSeconds: 120 } });
    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, idleSeconds: 120 });
  });
});
