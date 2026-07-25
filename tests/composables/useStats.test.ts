import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { resetDBConnection } from '@/lib/db/db';
import { invalidateSettings, saveSettings } from '@/lib/settings';
import * as repo from '@/lib/db/repo';
import { addDays, dateKey } from '@/lib/time';
import { useStats } from '@/composables/useStats';
import type { DailyStat, Session, TabMeta } from '@/lib/types';

// useStats is the whole dashboard's data pipeline — every tile reads its computeds.
// These cover the invariants the tiles depend on: active time excludes background
// audio and internal pages, the weekly average is per ACTIVE day, and the tab lists
// only ever describe tabs that are genuinely open.

const NOW = Date.now();
const TODAY = dateKey(NOW);
const DAY = 86_400_000;

const meta = (p: Partial<TabMeta>): TabMeta =>
  ({ tabId: 1, key: 'k1', url: 'https://a.com/', title: 'A', lastActiveAt: NOW, createdAt: NOW, ...p });
const session = (p: Partial<Session>): Session =>
  ({ tabId: 1, tabKey: 'k1', url: 'https://a.com/x', domain: 'a.com', start: NOW - 60_000, end: NOW, audio: false, ...p });

function stubTabs(tabs: Array<{ id: number; url: string; title?: string; windowId?: number }>) {
  vi.spyOn(browser.tabs, 'query').mockResolvedValue(tabs as never);
}

async function loaded(stats: DailyStat[] = [], opts: { metas?: TabMeta[]; sessions?: Session[] } = {}) {
  if (stats.length) await repo.commitSessions([], stats);
  for (const m of opts.metas ?? []) await repo.upsertTabMeta(m);
  if (opts.sessions?.length) await repo.commitSessions(opts.sessions, []);
  const s = useStats();
  await s.load();
  return s;
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDBConnection();
  invalidateSettings();
  vi.restoreAllMocks();
  stubTabs([]);
  vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined);
});

describe('useStats active-time derivations', () => {
  test('activeStats drops internal pages and subtracts background audio', async () => {
    const s = await loaded([
      { date: TODAY, domain: 'a.com', seconds: 600, audioSeconds: 120 },
      { date: TODAY, domain: 'chrome', seconds: 900, audioSeconds: 0 },
    ]);
    expect(s.activeStats.value.map((x) => [x.domain, x.seconds])).toEqual([['a.com', 480]]);
    expect(s.todaySeconds.value).toBe(480);
    expect(s.todayAudioSeconds.value).toBe(120);
  });

  test('todayByDomain hides audio-only domains and sorts by active time', async () => {
    const s = await loaded([
      { date: TODAY, domain: 'music.com', seconds: 600, audioSeconds: 600 },
      { date: TODAY, domain: 'a.com', seconds: 100, audioSeconds: 0 },
      { date: TODAY, domain: 'b.com', seconds: 300, audioSeconds: 0 },
    ]);
    expect(s.todayByDomain.value.map((d) => d.domain)).toEqual(['b.com', 'a.com']);
  });

  test('the weekly average divides by active days, not by seven', async () => {
    const s = await loaded([
      { date: addDays(TODAY, -1), domain: 'a.com', seconds: 3600, audioSeconds: 0 },
      { date: addDays(TODAY, -2), domain: 'a.com', seconds: 1800, audioSeconds: 0 },
      { date: TODAY, domain: 'a.com', seconds: 9999, audioSeconds: 0 }, // today is excluded
    ]);
    expect(s.weeklyActiveDays.value).toBe(2);
    expect(s.weeklyAvgSeconds.value).toBe(2700); // (3600 + 1800) / 2
  });

  test('an audio-only day is not counted as an active day', async () => {
    const s = await loaded([
      { date: addDays(TODAY, -1), domain: 'a.com', seconds: 3600, audioSeconds: 0 },
      { date: addDays(TODAY, -2), domain: 'music.com', seconds: 3600, audioSeconds: 3600 },
    ]);
    expect(s.weeklyActiveDays.value).toBe(1);
    expect(s.weeklyAvgSeconds.value).toBe(3600);
  });

  test('todayByCategory groups through the user\'s overrides', async () => {
    await saveSettings({ categoryOverrides: { 'a.com': 'Finance' } });
    const s = await loaded([{ date: TODAY, domain: 'a.com', seconds: 600, audioSeconds: 0 }]);
    expect(s.todayByCategory.value).toEqual([{ category: 'Finance', seconds: 600, audioSeconds: 0 }]);
  });

  test('productivity reads active seconds and the user\'s focus target', async () => {
    await saveSettings({ focusTarget: 60 });
    const s = await loaded([
      { date: TODAY, domain: 'github.com', seconds: 3600, audioSeconds: 0 }, // Dev → productive
      { date: TODAY, domain: 'reddit.com', seconds: 1200, audioSeconds: 0 }, // Social → distracting
    ]);
    expect(s.productivity.value.productiveSeconds).toBe(3600);
    expect(s.productivity.value.distractingSeconds).toBe(1200);
    expect(s.productivity.value.todayFocusPct).toBe(75);
    expect(s.productivity.value.focusTarget).toBe(60);
  });
});

describe('useStats tab lists', () => {
  test('only tabs that are actually open appear, and the extension\'s own pages never do', async () => {
    const own = browser.runtime.getURL('/dashboard.html');
    stubTabs([
      { id: 1, url: 'https://a.com/', title: 'A' },
      { id: 9, url: own, title: 'Dashboard' },
    ]);
    const s = await loaded([], { metas: [meta({ tabId: 1 }), meta({ tabId: 2, key: 'gone' })] });
    expect(s.openTabCount.value).toBe(1);
    expect(s.openTabsList.value.map((t) => t.tabId)).toEqual([1]);
    // The meta for the closed tab 2 is ignored rather than listed as open.
    expect(s.tabRows.value.map((r) => r.domain)).toEqual(['a.com']);
  });

  test('tabRows shows the domain total and how many tabs sit on it', async () => {
    stubTabs([
      { id: 1, url: 'https://a.com/one', title: 'One' },
      { id: 2, url: 'https://a.com/two', title: 'Two' },
    ]);
    const s = await loaded([{ date: TODAY, domain: 'a.com', seconds: 600, audioSeconds: 0 }], {
      metas: [meta({ tabId: 1, lastActiveAt: NOW - 5_000 }), meta({ tabId: 2, lastActiveAt: NOW })],
    });
    expect(s.tabRows.value).toHaveLength(1);
    expect(s.tabRows.value[0]).toMatchObject({ domain: 'a.com', seconds: 600, tabCount: 2, tabId: 2 });
  });

  test('stale tabs come back oldest-first, ready for the modal to show as-is', async () => {
    stubTabs([
      { id: 1, url: 'https://a.com/', title: 'A' },
      { id: 2, url: 'https://b.com/', title: 'B' },
    ]);
    await saveSettings({ staleDays: 3 });
    const s = await loaded([], {
      metas: [
        meta({ tabId: 1, url: 'https://a.com/', lastActiveAt: NOW - 5 * DAY }),
        meta({ tabId: 2, key: 'k2', url: 'https://b.com/', lastActiveAt: NOW - 9 * DAY }),
      ],
    });
    expect(s.staleTabItems.value.map((t) => t.tabId)).toEqual([2, 1]);
  });

  test('recentSessions keeps foreground web sessions only', async () => {
    const s = await loaded([], {
      sessions: [
        session({ domain: 'a.com' }),
        session({ domain: 'music.com', audio: true, tabKey: 'k2' }),
      ],
    });
    expect(s.recentSessions.value.map((x) => x.domain)).toEqual(['a.com']);
  });
});

describe('useStats load robustness', () => {
  test('a failed load surfaces an error flag and clears the spinner', async () => {
    vi.spyOn(repo, 'getStatsRange').mockRejectedValue(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = useStats();
    await s.load();
    expect(s.loadError.value).toBe(true);
    expect(s.loading.value).toBe(false);
  });

  test('a storage-quota warning from the worker is surfaced', async () => {
    await browser.storage.local.set({ storageWarning: true });
    const s = await loaded();
    expect(s.storageWarning.value).toBe(true);
  });

  test('the heatmap is a real 7×24 grid even before any data loads', () => {
    const s = useStats();
    expect(s.heatmap.value.grid).toHaveLength(7);
    expect(s.heatmap.value.grid[0]).toHaveLength(24);
  });
});
