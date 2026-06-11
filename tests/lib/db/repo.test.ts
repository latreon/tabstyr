import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';
import { resetDBConnection } from '@/lib/db/db';
import * as repo from '@/lib/db/repo';
import type { Session, TabMeta } from '@/lib/types';

const T0 = new Date(2026, 5, 11, 10, 0).getTime();
const DAY = 86_400_000;

function session(partial: Partial<Session>): Session {
  return { tabId: 1, url: 'https://a.com/x', domain: 'a.com', start: T0, end: T0 + 60_000, audio: false, ...partial };
}

function tabMeta(partial: Partial<TabMeta>): TabMeta {
  return { tabId: 1, url: 'https://a.com', title: 'A', lastActiveAt: T0, createdAt: T0, ...partial };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory(); // fresh DB per test
  resetDBConnection();
});

describe('sessions + stats', () => {
  test('addSessions then getSecondsByTab sums per tab', async () => {
    await repo.addSessions([session({}), session({ start: T0 + 100_000, end: T0 + 130_000 }), session({ tabId: 2 })]);
    const byTab = await repo.getSecondsByTab();
    expect(byTab.get(1)).toBe(90);
    expect(byTab.get(2)).toBe(60);
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

describe('prune + wipe', () => {
  test('pruneBefore keeps records exactly at the cutoff', async () => {
    await repo.addSessions([session({ start: T0, end: T0 + 60_000 })]);
    await repo.applyDailyStats([{ date: '2026-03-13', domain: 'a.com', seconds: 10, audioSeconds: 0 }]);
    await repo.pruneBefore('2026-03-13', T0);
    expect((await repo.getSecondsByTab()).get(1)).toBe(60);
    expect(await repo.getStatsRange('2026-03-13', '2026-03-13')).toHaveLength(1);
  });

  test('pruneBefore removes old sessions and old daily stats', async () => {
    await repo.addSessions([session({ start: T0 - 100 * DAY, end: T0 - 100 * DAY + 60_000 }), session({})]);
    await repo.applyDailyStats([
      { date: '2026-01-01', domain: 'a.com', seconds: 10, audioSeconds: 0 },
      { date: '2026-06-11', domain: 'a.com', seconds: 20, audioSeconds: 0 },
    ]);
    await repo.pruneBefore('2026-03-13', T0 - 90 * DAY);
    expect((await repo.getSecondsByTab()).get(1)).toBe(60);
    const stats = await repo.getStatsRange('2020-01-01', '2030-01-01');
    expect(stats.map((s) => s.date)).toEqual(['2026-06-11']);
  });

  test('wipeAll clears every store', async () => {
    await repo.addSessions([session({})]);
    await repo.upsertTabMeta(tabMeta({}));
    await repo.wipeAll();
    expect(await repo.getSecondsByTab()).toEqual(new Map());
    expect(await repo.getAllTabMeta()).toEqual([]);
  });
});
