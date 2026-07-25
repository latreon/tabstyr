import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { resetDBConnection } from '@/lib/db/db';
import { invalidateSettings } from '@/lib/settings';
import { useStats } from '@/composables/useStats';

// Every mutator here changes something the BACKGROUND worker reads: classification
// drives the continuous-session nudge, budgets drive the budget nudge. The worker
// caches settings in module scope, and on Firefox the background page is persistent —
// so without a settings-changed broadcast a domain the user just reclassified as
// productive kept firing "distracting" nudges for the rest of the session.

function sentTypes(): string[] {
  const send = browser.runtime.sendMessage as unknown as { mock: { calls: unknown[][] } };
  return send.mock.calls.map((args) => (args[0] as { type?: string })?.type ?? '');
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDBConnection();
  invalidateSettings();
  vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined);
});

describe('useStats settings mutators broadcast settings-changed', () => {
  const cases: Array<[string, (s: ReturnType<typeof useStats>) => Promise<void>]> = [
    ['setCategoryOverride', (s) => s.setCategoryOverride('example.com', 'Work')],
    ['setCategoryProductivity', (s) => s.setCategoryProductivity('Social', 'productive')],
    ['setCategoryBudget', (s) => s.setCategoryBudget('Social', 30)],
    ['addCategoryRule', (s) => s.addCategoryRule('mybank', 'Finance')],
    ['removeCategoryRule', (s) => s.removeCategoryRule('mybank')],
    ['dismissOnboarding', (s) => s.dismissOnboarding()],
  ];

  for (const [name, run] of cases) {
    test(`${name} notifies the background`, async () => {
      const s = useStats();
      await run(s);
      expect(sentTypes()).toContain('settings-changed');
    });
  }

  test('setCustomProductivity notifies the background', async () => {
    const s = useStats();
    // Needs an existing custom category to rewrite.
    s.settings.value = await import('@/lib/settings').then((m) =>
      m.saveSettings({ customCategories: [{ name: 'Learning', color: '#123abc', productivity: 'neutral' }] }),
    );
    await s.setCustomProductivity('Learning', 'productive');
    expect(sentTypes()).toContain('settings-changed');
  });

  test('the mutation is persisted, not just broadcast', async () => {
    const s = useStats();
    await s.setCategoryOverride('example.com', 'Work');
    expect(s.settings.value?.categoryOverrides['example.com']).toBe('Work');
    await s.setCategoryBudget('Social', 45);
    expect(s.settings.value?.categoryBudgets.Social).toBe(45);
    await s.setCategoryBudget('Social', null);
    expect(s.settings.value?.categoryBudgets.Social).toBeUndefined();
  });

  test('a failed broadcast does not break the save (no receiver is normal)', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockRejectedValue(new Error('no receiver'));
    const s = useStats();
    await expect(s.setCategoryOverride('example.com', 'Dev')).resolves.toBeUndefined();
    expect(s.settings.value?.categoryOverrides['example.com']).toBe('Dev');
  });
});
