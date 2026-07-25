import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';
import { TrackerEngine } from '@/lib/tracker/engine';
import { rollup } from '@/lib/tracker/aggregate';
import { resetDBConnection } from '@/lib/db/db';
import * as repo from '@/lib/db/repo';
import { dateKey } from '@/lib/time';
import type { ClosedSession, Session } from '@/lib/types';

const T0 = new Date(2026, 5, 11, 9, 0, 0).getTime();
const DATE = dateKey(T0);

// Mirror the background's stampKeys + persist EXACTLY: attach each tab's stable
// key, roll the slices up, and commit both in one transaction. Rolling up here
// (rather than committing empty deltas) is the point — it exercises the whole
// shipped path, so a regression in rollup or in the merge-on-commit shows up.
async function persist(closed: ClosedSession[], tabIdToKey: Record<number, string>) {
  const sessions: Session[] = closed.map((s) => ({ ...s, tabKey: tabIdToKey[s.tabId] }));
  await repo.commitSessions(sessions, rollup(sessions));
}

/** Stored active seconds for a domain on the tracked day. */
async function secondsFor(domain: string): Promise<number> {
  const stats = await repo.getStatsRange(DATE, DATE);
  return stats.find((s) => s.domain === domain)?.seconds ?? 0;
}

/** Foreground seconds per stable tab key — what `tabKey` attribution is for. */
async function secondsByKey(key: string): Promise<number> {
  const all = await repo.getAllSessions();
  return all
    .filter((s) => s.tabKey === key && !s.audio)
    .reduce((sum, s) => sum + (s.end - s.start) / 1000, 0);
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDBConnection();
});

describe('end-to-end tracking flow', () => {
  test('heartbeat checkpoints and a tab switch accumulate into per-domain daily totals', async () => {
    const keys = { 1: 'kA', 2: 'kB' };
    const e = new TrackerEngine();

    e.handleFocus(1, 'https://a.com', T0);
    await persist(e.checkpoint(T0 + 60_000), keys); // +60s on a.com
    await persist(e.checkpoint(T0 + 120_000), keys); // +60s on a.com
    await persist(e.handleFocus(2, 'https://b.com', T0 + 150_000), keys); // closes a.com (+30s)
    await persist(e.checkpoint(T0 + 210_000), keys); // +60s on b.com

    expect(await secondsFor('a.com')).toBe(150); // 60 + 60 + 30
    expect(await secondsFor('b.com')).toBe(60);
    // The same numbers, attributed per tab.
    expect(await secondsByKey('kA')).toBe(150);
    expect(await secondsByKey('kB')).toBe(60);
  });

  test('a restart that reuses a tab id does not merge the two tabs\' time', async () => {
    // Run 1: tab id 5 = key kX on site.com, accrues 2 minutes.
    const e1 = new TrackerEngine();
    e1.handleFocus(5, 'https://site.com', T0);
    await persist(e1.checkpoint(T0 + 120_000), { 5: 'kX' });

    // Run 2 (after restart): the browser reuses id 5 for a DIFFERENT tab (key kY).
    const e2 = new TrackerEngine();
    e2.handleFocus(5, 'https://other.com', T0 + 1_000_000);
    await persist(e2.checkpoint(T0 + 1_060_000), { 5: 'kY' });

    expect(await secondsByKey('kX')).toBe(120); // original tab keeps its time
    expect(await secondsByKey('kY')).toBe(60); // reused id does NOT inherit it
    expect(await secondsFor('site.com')).toBe(120);
    expect(await secondsFor('other.com')).toBe(60);
  });

  test('background audio is recorded as audio seconds, not as foreground time', async () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://docs.com', T0);
    e.syncAudio([{ tabId: 2, url: 'https://music.com' }], T0);
    await persist(e.checkpoint(T0 + 60_000), { 1: 'kDocs', 2: 'kMusic' });

    const stats = await repo.getStatsRange(DATE, DATE);
    expect(stats).toContainEqual({ date: DATE, domain: 'docs.com', seconds: 60, audioSeconds: 0 });
    // Audio time is stored in BOTH fields; every reader subtracts audioSeconds to
    // get active time (lib/metrics.activeSeconds), so music.com contributes 0 active.
    expect(stats).toContainEqual({ date: DATE, domain: 'music.com', seconds: 60, audioSeconds: 60 });
    expect(await secondsByKey('kDocs')).toBe(60);
    expect(await secondsByKey('kMusic')).toBe(0); // audio-only → no foreground time
  });

  test('many short slices sum to exact seconds (no per-commit rounding drift)', async () => {
    // Each slice is 1.5s, so rounding every commit would drift; rollup deliberately
    // keeps exact fractions and only display/export rounds.
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    for (let i = 1; i <= 20; i++) await persist(e.checkpoint(T0 + i * 1_500), { 1: 'kA' });
    expect(await secondsFor('a.com')).toBe(30); // 20 × 1.5s exactly
  });
});
