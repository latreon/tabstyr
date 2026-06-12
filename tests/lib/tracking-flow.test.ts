import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';
import { TrackerEngine } from '@/lib/tracker/engine';
import { resetDBConnection } from '@/lib/db/db';
import * as repo from '@/lib/db/repo';
import type { ClosedSession, Session } from '@/lib/types';

const T0 = new Date(2026, 5, 11, 9, 0, 0).getTime();

// Mimic the background's stampKeys + persist: attach each tab's stable key and commit.
async function persist(closed: ClosedSession[], tabIdToKey: Record<number, string>) {
  const sessions: Session[] = closed.map((s) => ({ ...s, tabKey: tabIdToKey[s.tabId] }));
  await repo.commitSessions(sessions, []);
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDBConnection();
});

describe('end-to-end per-tab time attribution', () => {
  test('a focused tab accrues heartbeat checkpoints and a final switch, summed by key', async () => {
    const keys = { 1: 'kA', 2: 'kB' };
    const e = new TrackerEngine();

    e.handleFocus(1, 'https://a.com', T0);
    await persist(e.checkpoint(T0 + 60_000), keys); // +60s on tab 1
    await persist(e.checkpoint(T0 + 120_000), keys); // +60s on tab 1
    await persist(e.handleFocus(2, 'https://b.com', T0 + 150_000), keys); // closes tab1 (+30s)
    await persist(e.checkpoint(T0 + 210_000), keys); // +60s on tab 2

    const byKey = await repo.getSecondsForKeys(['kA', 'kB']);
    expect(byKey.get('kA')).toBe(150); // 60 + 60 + 30
    expect(byKey.get('kB')).toBe(60);
  });

  test('tab time survives a simulated restart that reuses the tab id under the same key', async () => {
    // Run 1: tab id 5 = key kX, accrues 2 minutes.
    const e1 = new TrackerEngine();
    e1.handleFocus(5, 'https://site.com', T0);
    await persist(e1.checkpoint(T0 + 120_000), { 5: 'kX' });

    // Run 2 (after restart): the browser reuses id 5 for a DIFFERENT tab (key kY).
    const e2 = new TrackerEngine();
    e2.handleFocus(5, 'https://other.com', T0 + 1_000_000);
    await persist(e2.checkpoint(T0 + 1_060_000), { 5: 'kY' }); // +60s under kY

    const byKey = await repo.getSecondsForKeys(['kX', 'kY']);
    expect(byKey.get('kX')).toBe(120); // original tab keeps its time
    expect(byKey.get('kY')).toBe(60); // reused id does NOT inherit it
  });

  test('audio session time is attributed to its own tab key, separate from the focused tab', async () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://docs.com', T0);
    e.syncAudio([{ tabId: 2, url: 'https://music.com' }], T0);
    await persist(e.checkpoint(T0 + 60_000), { 1: 'kDocs', 2: 'kMusic' });

    const byKey = await repo.getSecondsForKeys(['kDocs', 'kMusic']);
    expect(byKey.get('kDocs')).toBe(60);
    expect(byKey.get('kMusic')).toBe(60);
  });
});
