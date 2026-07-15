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

  test('categoryProductivity defaults to the built-in mapping', async () => {
    const s = await getSettings();
    expect(s.categoryProductivity.Work).toBe('productive');
    expect(s.categoryProductivity.Social).toBe('distracting');
    expect(s.categoryProductivity.Finance).toBe('neutral');
  });

  test('categoryProductivity round-trips a user remap and keeps other categories at default', async () => {
    await saveSettings({ categoryProductivity: { Social: 'productive' } as Parameters<typeof saveSettings>[0]['categoryProductivity'] });
    const s = await getSettings();
    expect(s.categoryProductivity.Social).toBe('productive'); // remapped
    expect(s.categoryProductivity.Work).toBe('productive'); // untouched default
    expect(s.categoryProductivity.Media).toBe('distracting'); // untouched default
  });

  test('invalid categoryProductivity entries fall back to the default (full valid mapping)', async () => {
    await fakeBrowser.storage.local.set({
      settings: { categoryProductivity: { Work: 'bogus', Social: 'productive', NotACategory: 'productive' } },
    });
    const s = await getSettings();
    expect(s.categoryProductivity.Work).toBe('productive'); // bad value → default
    expect(s.categoryProductivity.Social).toBe('productive'); // valid override kept
    expect((s.categoryProductivity as Record<string, unknown>).NotACategory).toBeUndefined();
    expect(Object.keys(s.categoryProductivity).sort()).toEqual(
      ['Dev', 'Finance', 'Media', 'News', 'Other', 'Shopping', 'Social', 'Work'].sort(),
    );
  });

  test('focusTarget defaults to 50 and is clamped to 10–90', async () => {
    expect((await getSettings()).focusTarget).toBe(50);
    await fakeBrowser.storage.local.set({ settings: { focusTarget: 5 } });
    invalidateSettings();
    expect((await getSettings()).focusTarget).toBe(10);
    await fakeBrowser.storage.local.set({ settings: { focusTarget: 200 } });
    invalidateSettings();
    expect((await getSettings()).focusTarget).toBe(90);
  });

  test('categoryBudgets keeps positive minute values and drops junk / unknown categories', async () => {
    await fakeBrowser.storage.local.set({
      settings: {
        categoryBudgets: { Social: 30, Media: 0, Work: -5, News: 2000, NotACategory: 10, Dev: 'x' },
      },
    });
    const b = (await getSettings()).categoryBudgets;
    expect(b.Social).toBe(30); // kept
    expect(b.News).toBe(1440); // clamped to 24h
    expect('Media' in b).toBe(false); // 0 dropped
    expect('Work' in b).toBe(false); // negative dropped
    expect('Dev' in b).toBe(false); // non-number dropped
    expect((b as Record<string, unknown>).NotACategory).toBeUndefined(); // unknown dropped
  });

  test('categoryBudgets round-trips a saved budget', async () => {
    await saveSettings({ categoryBudgets: { Social: 45 } });
    expect((await getSettings()).categoryBudgets).toEqual({ Social: 45 });
  });

  test('categoryBudgets accepts custom category names', async () => {
    await saveSettings({ customCategories: [{ name: 'Gaming', color: '#ff0000', productivity: 'distracting' }] });
    await saveSettings({ categoryBudgets: { Gaming: 60, Social: 30 } });
    expect((await getSettings()).categoryBudgets).toEqual({ Gaming: 60, Social: 30 });
  });

  test('categoryBudgets drops a budget for a name that is not a custom category', async () => {
    await fakeBrowser.storage.local.set({
      settings: {
        customCategories: [{ name: 'Gaming', color: '#ff0000', productivity: 'neutral' }],
        categoryBudgets: { Gaming: 60, Studying: 45 }, // Studying is not defined
      },
    });
    expect((await getSettings()).categoryBudgets).toEqual({ Gaming: 60 });
  });

  test('deleting a custom category drops its budget on the next save', async () => {
    await saveSettings({ customCategories: [{ name: 'Gaming', color: '#ff0000', productivity: 'neutral' }] });
    await saveSettings({ categoryBudgets: { Gaming: 60, Social: 30 } });
    await saveSettings({ customCategories: [] }); // user removes the category
    expect((await getSettings()).categoryBudgets).toEqual({ Social: 30 }); // Gaming budget gone
  });

  test('legacy built-in-only budgets still load unchanged', async () => {
    await fakeBrowser.storage.local.set({
      settings: { categoryBudgets: { Social: 30, Media: 90 } }, // pre-custom-budget shape
    });
    expect((await getSettings()).categoryBudgets).toEqual({ Social: 30, Media: 90 });
  });

  // Legacy stored settings/backups may still carry removed fields (e.g. the old
  // domainTags project-tag map). coerce() copies field-by-field, so unknown keys
  // must be silently dropped rather than throwing or leaking through.
  test('unknown legacy fields (e.g. old domainTags) are silently dropped', async () => {
    await fakeBrowser.storage.local.set({
      settings: { staleDays: 5, domainTags: { 'github.com': 'Acme' } },
    });
    const s = await getSettings();
    expect(s.staleDays).toBe(5);
    expect('domainTags' in s).toBe(false);
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

  test('sessionAlertMinutes defaults to 30 and is clamped to 0–180', async () => {
    expect((await getSettings()).sessionAlertMinutes).toBe(30);
    await fakeBrowser.storage.local.set({ settings: { sessionAlertMinutes: -5 } });
    invalidateSettings();
    expect((await getSettings()).sessionAlertMinutes).toBe(0);
    await fakeBrowser.storage.local.set({ settings: { sessionAlertMinutes: 999 } });
    invalidateSettings();
    expect((await getSettings()).sessionAlertMinutes).toBe(180);
  });

  test('sessionAlertMinutes of 0 (off) round-trips unchanged', async () => {
    await saveSettings({ sessionAlertMinutes: 0 });
    expect((await getSettings()).sessionAlertMinutes).toBe(0);
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

  describe('excludedDomains', () => {
    test('defaults to an empty list', async () => {
      expect((await getSettings()).excludedDomains).toEqual([]);
    });

    test('a saved list round-trips, normalized', async () => {
      await saveSettings({ excludedDomains: [' Reddit.com ', 'x.com'] });
      expect((await getSettings()).excludedDomains).toEqual(['reddit.com', 'x.com']);
    });

    test('non-array stored value falls back to the default', async () => {
      await fakeBrowser.storage.local.set({ settings: { excludedDomains: 'reddit.com' } });
      expect((await getSettings()).excludedDomains).toEqual([]);
    });

    test('drops blank and duplicate entries and caps the list at 200', async () => {
      const many = Array.from({ length: 250 }, (_, i) => `site${i}.com`);
      await fakeBrowser.storage.local.set({ settings: { excludedDomains: ['', ...many, ...many] } });
      const stored = (await getSettings()).excludedDomains;
      expect(stored).toHaveLength(200);
      expect(stored).not.toContain('');
    });
  });

  describe('custom categories', () => {
    const CAT = { name: 'Learning', color: '#123abc', productivity: 'productive' as const };

    test('defaults to an empty list', async () => {
      expect((await getSettings()).customCategories).toEqual([]);
    });

    test('a valid custom category round-trips', async () => {
      await saveSettings({ customCategories: [CAT] });
      expect((await getSettings()).customCategories).toEqual([CAT]);
    });

    test('rejects a name that collides with a built-in', async () => {
      await saveSettings({ customCategories: [{ name: 'Work', color: '#123abc', productivity: 'neutral' }] });
      expect((await getSettings()).customCategories).toEqual([]);
    });

    test('drops entries with an invalid hex color or bad productivity', async () => {
      await saveSettings({
        customCategories: [
          { name: 'BadColor', color: 'red', productivity: 'neutral' },
          { name: 'BadProd', color: '#abcdef', productivity: 'ultra' },
        ],
      } as unknown as Parameters<typeof saveSettings>[0]);
      const stored = (await getSettings()).customCategories;
      expect(stored.find((c) => c.name === 'BadColor')).toBeUndefined();
      // A bad productivity is coerced to 'neutral' rather than dropping the category.
      expect(stored.find((c) => c.name === 'BadProd')?.productivity).toBe('neutral');
    });

    test('dedupes custom names case-insensitively', async () => {
      await saveSettings({
        customCategories: [
          { name: 'Gaming', color: '#111111', productivity: 'distracting' },
          { name: 'gaming', color: '#222222', productivity: 'neutral' },
        ],
      });
      expect((await getSettings()).customCategories).toHaveLength(1);
    });

    test('an override or rule pointing at a valid custom name is kept', async () => {
      await saveSettings({
        customCategories: [CAT],
        categoryOverrides: { 'coursera.org': 'Learning' },
        categoryRules: [{ pattern: 'udemy', category: 'Learning' }],
      });
      const s = await getSettings();
      expect(s.categoryOverrides['coursera.org']).toBe('Learning');
      expect(s.categoryRules).toEqual([{ pattern: 'udemy', category: 'Learning' }]);
    });

    test('removing a custom category drops overrides/rules that referenced it', async () => {
      await saveSettings({
        customCategories: [CAT],
        categoryOverrides: { 'coursera.org': 'Learning' },
        categoryRules: [{ pattern: 'udemy', category: 'Learning' }],
      });
      // Save the list without the custom category — its references are now invalid.
      await saveSettings({ customCategories: [] });
      const s = await getSettings();
      expect(s.categoryOverrides).toEqual({});
      expect(s.categoryRules).toEqual([]);
    });
  });
});
