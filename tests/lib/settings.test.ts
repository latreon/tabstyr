import { beforeEach, describe, expect, test } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { DEFAULT_SETTINGS, getSettings, invalidateSettings, saveSettings } from '@/lib/settings';

describe('settings', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    invalidateSettings(); // drop the in-process cache so each test reads fresh storage
  });

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

  test('successive saveSettings calls accumulate patches', async () => {
    await saveSettings({ staleDays: 7 });
    await saveSettings({ idleSeconds: 90 });
    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, staleDays: 7, idleSeconds: 90 });
  });

  test('saveSettings sanitizes the patch before persisting (clamp + drop junk)', async () => {
    // Cast through unknown to simulate a hostile/invalid patch (e.g. from import).
    await saveSettings({ idleSeconds: 99999, junkKey: 'x' } as unknown as Parameters<typeof saveSettings>[0]);
    const stored = (await fakeBrowser.storage.local.get('settings')).settings as Record<string, unknown>;
    expect(stored.idleSeconds).toBe(600); // clamped at write time, not only read time
    expect('junkKey' in stored).toBe(false); // unknown key never persisted
  });

  test('saveSettings caps a huge categoryOverrides object', async () => {
    const overrides: Record<string, string> = {};
    for (let i = 0; i < 6000; i++) overrides[`d${i}.com`] = 'Work';
    await saveSettings({ categoryOverrides: overrides } as Parameters<typeof saveSettings>[0]);
    const stored = (await fakeBrowser.storage.local.get('settings')).settings as { categoryOverrides: object };
    expect(Object.keys(stored.categoryOverrides).length).toBeLessThanOrEqual(5000);
  });

  test('malformed stored values are ignored, defaults win', async () => {
    await fakeBrowser.storage.local.set({ settings: { staleDays: 'seven', audioEnabled: false } });
    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, audioEnabled: false });
  });

  test('out-of-range stored numbers are clamped', async () => {
    await fakeBrowser.storage.local.set({ settings: { staleDays: 0, idleSeconds: 99999 } });
    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, staleDays: 1, idleSeconds: 600 });
  });

  test('notificationsEnabled round-trips and a non-boolean falls back to the default', async () => {
    await saveSettings({ notificationsEnabled: false });
    expect((await getSettings()).notificationsEnabled).toBe(false);
    invalidateSettings();
    await fakeBrowser.storage.local.set({ settings: { notificationsEnabled: 'yes' } });
    expect((await getSettings()).notificationsEnabled).toBe(true); // default
  });

  test('invalid theme value is ignored, default wins', async () => {
    await fakeBrowser.storage.local.set({ settings: { theme: 'neon' } });
    expect((await getSettings()).theme).toBe('system');
  });

  test('valid theme value round-trips', async () => {
    await saveSettings({ theme: 'dark' });
    expect((await getSettings()).theme).toBe('dark');
  });

  test('category overrides round-trip and drop invalid entries', async () => {
    await fakeBrowser.storage.local.set({
      settings: { categoryOverrides: { 'a.com': 'Work', 'b.com': 'Nonsense', 'c.com': 'Social' } },
    });
    expect((await getSettings()).categoryOverrides).toEqual({ 'a.com': 'Work', 'c.com': 'Social' });
  });

  test('non-object categoryOverrides is ignored', async () => {
    await fakeBrowser.storage.local.set({ settings: { categoryOverrides: 'nope' } });
    expect((await getSettings()).categoryOverrides).toEqual({});
  });

  test('saveSettings persists a category override', async () => {
    await saveSettings({ categoryOverrides: { 'x.com': 'Dev' } });
    expect((await getSettings()).categoryOverrides).toEqual({ 'x.com': 'Dev' });
  });

  test('category rules round-trip, normalise, and drop invalid/duplicate/blank entries', async () => {
    await fakeBrowser.storage.local.set({
      settings: {
        categoryRules: [
          { pattern: '  YANDEX ', category: 'Work' }, // trimmed + lowercased
          { pattern: 'yandex', category: 'Social' }, //  duplicate of the above → dropped
          { pattern: '', category: 'Dev' }, //            blank → dropped
          { pattern: 'bilibili', category: 'Nonsense' }, // bad category → dropped
          { pattern: 'taobao', category: 'Shopping' },
        ],
      },
    });
    expect((await getSettings()).categoryRules).toEqual([
      { pattern: 'yandex', category: 'Work' },
      { pattern: 'taobao', category: 'Shopping' },
    ]);
  });

  test('non-array categoryRules is ignored (falls back to default [])', async () => {
    await fakeBrowser.storage.local.set({ settings: { categoryRules: 'nope' } });
    expect((await getSettings()).categoryRules).toEqual([]);
  });

  test('caps the number of stored rules', async () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ pattern: `p${i}`, category: 'Work' as const }));
    await fakeBrowser.storage.local.set({ settings: { categoryRules: many } });
    expect((await getSettings()).categoryRules.length).toBe(100);
  });

  test('onboarded flag round-trips', async () => {
    expect((await getSettings()).onboarded).toBe(false);
    await saveSettings({ onboarded: true });
    expect((await getSettings()).onboarded).toBe(true);
  });

  test('language defaults to auto and round-trips', async () => {
    expect((await getSettings()).language).toBe('auto');
    await saveSettings({ language: 'ja' });
    expect((await getSettings()).language).toBe('ja');
  });
});
