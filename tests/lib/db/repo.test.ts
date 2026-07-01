import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';
import { resetDBConnection } from '@/lib/db/db';
import * as repo from '@/lib/db/repo';
import type { Session, TabMeta } from '@/lib/types';

const T0 = new Date(2026, 5, 11, 10, 0).getTime();
const DAY = 86_400_000;

function session(partial: Partial<Session>): Session {
  return { tabId: 1, tabKey: 'k1', url: 'https://a.com/x', domain: 'a.com', start: T0, end: T0 + 60_000, audio: false, ...partial };
}

function tabMeta(partial: Partial<TabMeta>): TabMeta {
  return { tabId: 1, key: 'mk1', url: 'https://a.com', title: 'A', lastActiveAt: T0, createdAt: T0, ...partial };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory(); // fresh DB per test
  resetDBConnection();
});

describe('sessions + stats', () => {
  test('addSessions then getSecondsForKeys sums per stable key', async () => {
    await repo.addSessions([
      session({}),
      session({ start: T0 + 100_000, end: T0 + 130_000 }),
      session({ tabId: 2, tabKey: 'k2' }),
    ]);
    const byKey = await repo.getSecondsForKeys(['k1', 'k2']);
    expect(byKey.get('k1')).toBe(90);
    expect(byKey.get('k2')).toBe(60);
  });

  test('getSecondsForKeys reads only requested keys and survives tabId reuse', async () => {
    // Same numeric tabId, different stable keys (a restart reused the id) — totals stay separate.
    await repo.addSessions([session({ tabId: 7, tabKey: 'old' }), session({ tabId: 7, tabKey: 'new' })]);
    const byKey = await repo.getSecondsForKeys(['new']);
    expect(byKey.get('new')).toBe(60);
    expect(byKey.has('old')).toBe(false); // not requested → not loaded
  });

  test('getSecondsForKeys returns an empty map for no keys', async () => {
    await repo.addSessions([session({})]);
    expect(await repo.getSecondsForKeys([])).toEqual(new Map());
  });

  test('getSecondsForKeys excludes background-audio sessions', async () => {
    await repo.addSessions([
      session({}), // 60s foreground
      session({ start: T0 + 100_000, end: T0 + 130_000, audio: true }), // 30s audio → ignored
    ]);
    expect((await repo.getSecondsForKeys(['k1'])).get('k1')).toBe(60);
  });

  test('commitSessions writes sessions and stats in one transaction', async () => {
    await repo.commitSessions(
      [session({}), session({ tabKey: 'k2', tabId: 2 })],
      [{ date: '2026-06-11', domain: 'a.com', seconds: 120, audioSeconds: 0 }],
    );
    expect((await repo.getSecondsForKeys(['k1', 'k2'])).get('k1')).toBe(60);
    expect(await repo.getStatsRange('2026-06-11', '2026-06-11')).toEqual([
      { date: '2026-06-11', domain: 'a.com', seconds: 120, audioSeconds: 0 },
    ]);
  });

  test('commitSessions accumulates stat deltas into existing rows', async () => {
    await repo.applyDailyStats([{ date: '2026-06-11', domain: 'a.com', seconds: 60, audioSeconds: 0 }]);
    await repo.commitSessions([session({})], [{ date: '2026-06-11', domain: 'a.com', seconds: 30, audioSeconds: 30 }]);
    expect(await repo.getStatsRange('2026-06-11', '2026-06-11')).toEqual([
      { date: '2026-06-11', domain: 'a.com', seconds: 90, audioSeconds: 30 },
    ]);
  });

  test('applyDailyStatsMax takes the max per row and is idempotent', async () => {
    await repo.applyDailyStats([{ date: '2026-06-11', domain: 'a.com', seconds: 100, audioSeconds: 20 }]);
    // Lower import → existing kept; higher field → raised.
    await repo.applyDailyStatsMax([{ date: '2026-06-11', domain: 'a.com', seconds: 60, audioSeconds: 40 }]);
    await repo.applyDailyStatsMax([{ date: '2026-06-11', domain: 'b.com', seconds: 30, audioSeconds: 0 }]);
    // Re-applying the same import changes nothing.
    await repo.applyDailyStatsMax([{ date: '2026-06-11', domain: 'a.com', seconds: 60, audioSeconds: 40 }]);
    const stats = await repo.getStatsRange('2026-06-11', '2026-06-11');
    expect(stats).toContainEqual({ date: '2026-06-11', domain: 'a.com', seconds: 100, audioSeconds: 40 });
    expect(stats).toContainEqual({ date: '2026-06-11', domain: 'b.com', seconds: 30, audioSeconds: 0 });
  });

  test('applyDailyStats accumulates into existing rows', async () => {
    await repo.applyDailyStats([{ date: '2026-06-11', domain: 'a.com', seconds: 60, audioSeconds: 0 }]);
    await repo.applyDailyStats([{ date: '2026-06-11', domain: 'a.com', seconds: 30, audioSeconds: 30 }]);
    const stats = await repo.getStatsRange('2026-06-11', '2026-06-11');
    expect(stats).toEqual([{ date: '2026-06-11', domain: 'a.com', seconds: 90, audioSeconds: 30 }]);
  });

  test('getStatsRange filters by date range', async () => {
    await repo.applyDailyStats([
      { date: '2026-06-01', domain: 'a.com', seconds: 10, audioSeconds: 0 },
      { date: '2026-06-11', domain: 'a.com', seconds: 20, audioSeconds: 0 },
    ]);
    const stats = await repo.getStatsRange('2026-06-05', '2026-06-30');
    expect(stats).toHaveLength(1);
    expect(stats[0].date).toBe('2026-06-11');
  });

  test('getStatsRange from==to returns all domains for that single day', async () => {
    await repo.applyDailyStats([
      { date: '2026-06-11', domain: 'a.com', seconds: 10, audioSeconds: 0 },
      { date: '2026-06-11', domain: 'z.com', seconds: 20, audioSeconds: 0 },
      { date: '2026-06-12', domain: 'a.com', seconds: 5, audioSeconds: 0 },
    ]);
    const stats = await repo.getStatsRange('2026-06-11', '2026-06-11');
    expect(stats).toHaveLength(2);
  });
});

describe('tabMeta', () => {
  test('upsert, get, getAll, remove round-trip', async () => {
    await repo.upsertTabMeta(tabMeta({}));
    expect((await repo.getTabMeta(1))?.title).toBe('A');
    await repo.upsertTabMeta(tabMeta({ tabId: 2 }));
    expect(await repo.getAllTabMeta()).toHaveLength(2);
    await repo.removeTabMeta(1);
    expect(await repo.getTabMeta(1)).toBeUndefined();
  });

  test('replaceAllTabMeta swaps the whole store', async () => {
    await repo.upsertTabMeta(tabMeta({ tabId: 1 }));
    await repo.replaceAllTabMeta([tabMeta({ tabId: 9 })]);
    const all = await repo.getAllTabMeta();
    expect(all.map((m) => m.tabId)).toEqual([9]);
  });

  test('replaceAllTabMeta with empty array clears the store', async () => {
    await repo.upsertTabMeta(tabMeta({ tabId: 1 }));
    await repo.replaceAllTabMeta([]);
    expect(await repo.getAllTabMeta()).toEqual([]);
  });
});

describe('backfillKeylessSessions', () => {
  function keyless(partial: Partial<Session>): Session {
    const s = session(partial);
    delete (s as { tabKey?: string }).tabKey;
    return s;
  }

  test('stamps only keyless sessions whose tabId matches a current tab', async () => {
    await repo.addSessions([
      keyless({ tabId: 1 }), // legacy, tab still open
      session({ tabId: 1, tabKey: 'k1' }), // already keyed
      keyless({ tabId: 99 }), // legacy, tab no longer open
    ]);
    const updated = await repo.backfillKeylessSessions(new Map([[1, 'k1']]));
    expect(updated).toBe(1);
    // both tabId-1 sessions now sum under k1; the gone tab stays unattributed
    expect((await repo.getSecondsForKeys(['k1'])).get('k1')).toBe(120);
  });

  test('is a no-op for an empty map', async () => {
    await repo.addSessions([keyless({ tabId: 1 })]);
    expect(await repo.backfillKeylessSessions(new Map())).toBe(0);
  });
});

describe('prune + wipe', () => {
  test('pruneBefore keeps records exactly at the cutoff', async () => {
    await repo.addSessions([session({ start: T0, end: T0 + 60_000 })]);
    await repo.applyDailyStats([{ date: '2026-03-13', domain: 'a.com', seconds: 10, audioSeconds: 0 }]);
    await repo.pruneBefore('2026-03-13', T0);
    expect((await repo.getSecondsForKeys(['k1'])).get('k1')).toBe(60);
    expect(await repo.getStatsRange('2026-03-13', '2026-03-13')).toHaveLength(1);
  });

  test('pruneBefore removes old sessions and old daily stats', async () => {
    await repo.addSessions([session({ start: T0 - 100 * DAY, end: T0 - 100 * DAY + 60_000 }), session({})]);
    await repo.applyDailyStats([
      { date: '2026-01-01', domain: 'a.com', seconds: 10, audioSeconds: 0 },
      { date: '2026-06-11', domain: 'a.com', seconds: 20, audioSeconds: 0 },
    ]);
    await repo.pruneBefore('2026-03-13', T0 - 90 * DAY);
    expect((await repo.getSecondsForKeys(['k1'])).get('k1')).toBe(60);
    const stats = await repo.getStatsRange('2020-01-01', '2030-01-01');
    expect(stats.map((s) => s.date)).toEqual(['2026-06-11']);
  });

  test('wipeAll clears every store', async () => {
    await repo.addSessions([session({})]);
    await repo.upsertTabMeta(tabMeta({}));
    await repo.applyMonthlyStats([{ month: '2026-01', domain: 'a.com', seconds: 100, audioSeconds: 0 }]);
    await repo.wipeAll();
    expect(await repo.getSecondsForKeys(['k1'])).toEqual(new Map());
    expect(await repo.getAllTabMeta()).toEqual([]);
    expect(await repo.getAllMonthlyStats()).toEqual([]);
  });
});

describe('monthly rollup archive', () => {
  test('pruneBefore archives pruned daily rows into monthly totals, summed by month+domain', async () => {
    await repo.applyDailyStats([
      { date: '2026-01-05', domain: 'a.com', seconds: 100, audioSeconds: 10 },
      { date: '2026-01-20', domain: 'a.com', seconds: 50, audioSeconds: 0 },
      { date: '2026-02-02', domain: 'a.com', seconds: 30, audioSeconds: 0 },
      { date: '2026-01-06', domain: 'b.com', seconds: 25, audioSeconds: 0 },
      { date: '2026-06-11', domain: 'a.com', seconds: 999, audioSeconds: 0 }, // recent → survives
    ]);
    await repo.pruneBefore('2026-03-13', T0 - 90 * DAY);
    // Recent day stays raw.
    expect((await repo.getStatsRange('2020-01-01', '2030-01-01')).map((s) => s.date)).toEqual(['2026-06-11']);
    // Pruned days rolled up per (month, domain).
    const monthly = await repo.getAllMonthlyStats();
    expect(monthly).toContainEqual({ month: '2026-01', domain: 'a.com', seconds: 150, audioSeconds: 10 });
    expect(monthly).toContainEqual({ month: '2026-02', domain: 'a.com', seconds: 30, audioSeconds: 0 });
    expect(monthly).toContainEqual({ month: '2026-01', domain: 'b.com', seconds: 25, audioSeconds: 0 });
    expect(monthly).toHaveLength(3);
  });

  test('re-running pruneBefore does not double-count into the archive (idempotent)', async () => {
    await repo.applyDailyStats([{ date: '2026-01-05', domain: 'a.com', seconds: 100, audioSeconds: 0 }]);
    await repo.pruneBefore('2026-03-13', T0 - 90 * DAY);
    await repo.pruneBefore('2026-03-13', T0 - 90 * DAY); // second run finds the daily row already gone
    const monthly = await repo.getAllMonthlyStats();
    expect(monthly).toEqual([{ month: '2026-01', domain: 'a.com', seconds: 100, audioSeconds: 0 }]);
  });

  test('successive prunes accumulate into the same month bucket', async () => {
    await repo.applyDailyStats([{ date: '2026-01-05', domain: 'a.com', seconds: 100, audioSeconds: 0 }]);
    await repo.pruneBefore('2026-01-10', T0); // archives Jan 5
    await repo.applyDailyStats([{ date: '2026-01-09', domain: 'a.com', seconds: 40, audioSeconds: 0 }]);
    await repo.pruneBefore('2026-01-10', T0); // archives Jan 9 into the existing Jan bucket
    expect(await repo.getAllMonthlyStats()).toEqual([
      { month: '2026-01', domain: 'a.com', seconds: 140, audioSeconds: 0 },
    ]);
  });

  test('getMonthlyRange filters by month key', async () => {
    await repo.applyMonthlyStats([
      { month: '2025-12', domain: 'a.com', seconds: 10, audioSeconds: 0 },
      { month: '2026-01', domain: 'a.com', seconds: 20, audioSeconds: 0 },
      { month: '2026-02', domain: 'a.com', seconds: 30, audioSeconds: 0 },
    ]);
    const got = await repo.getMonthlyRange('2026-01', '2026-02');
    expect(got.map((m) => m.month).sort()).toEqual(['2026-01', '2026-02']);
  });

  test('applyMonthlyStats merges into existing rows', async () => {
    await repo.applyMonthlyStats([{ month: '2026-01', domain: 'a.com', seconds: 20, audioSeconds: 5 }]);
    await repo.applyMonthlyStats([{ month: '2026-01', domain: 'a.com', seconds: 30, audioSeconds: 0 }]);
    expect(await repo.getAllMonthlyStats()).toEqual([
      { month: '2026-01', domain: 'a.com', seconds: 50, audioSeconds: 5 },
    ]);
  });
});
