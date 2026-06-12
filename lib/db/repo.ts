import { getDB } from './db';
import type { DailyStat, Session, TabMeta } from '../types';

export async function addSessions(sessions: Session[]): Promise<void> {
  if (!sessions.length) return;
  const db = await getDB();
  const tx = db.transaction('sessions', 'readwrite');
  for (const s of sessions) await tx.store.add(s);
  await tx.done;
}

function mergeStat(existing: DailyStat | undefined, d: DailyStat): DailyStat {
  return existing
    ? {
        ...existing,
        seconds: existing.seconds + d.seconds,
        audioSeconds: existing.audioSeconds + d.audioSeconds,
      }
    : d;
}

export async function applyDailyStats(deltas: DailyStat[]): Promise<void> {
  if (!deltas.length) return;
  const db = await getDB();
  const tx = db.transaction('dailyDomainStats', 'readwrite');
  for (const d of deltas) {
    await tx.store.put(mergeStat(await tx.store.get([d.date, d.domain]), d));
  }
  await tx.done;
}

/**
 * Persist sessions and their daily-stat deltas in a SINGLE transaction so the
 * two stores can never diverge if the worker dies mid-write.
 */
export async function commitSessions(sessions: Session[], deltas: DailyStat[]): Promise<void> {
  if (!sessions.length && !deltas.length) return;
  const db = await getDB();
  const tx = db.transaction(['sessions', 'dailyDomainStats'], 'readwrite');
  const sessionStore = tx.objectStore('sessions');
  const statStore = tx.objectStore('dailyDomainStats');
  for (const s of sessions) await sessionStore.add(s);
  for (const d of deltas) {
    await statStore.put(mergeStat(await statStore.get([d.date, d.domain]), d));
  }
  await tx.done;
}

export async function getStatsRange(from: string, to: string): Promise<DailyStat[]> {
  const db = await getDB();
  return db.getAll('dailyDomainStats', IDBKeyRange.bound([from, ''], [to, '￿']));
}

export async function getAllDailyStats(): Promise<DailyStat[]> {
  return (await getDB()).getAll('dailyDomainStats');
}

export async function getAllSessions(): Promise<Session[]> {
  return (await getDB()).getAll('sessions');
}

/** Sessions whose start is at or after `ts`, via the `by-start` index. */
export async function getSessionsSince(ts: number): Promise<Session[]> {
  const db = await getDB();
  return db.getAllFromIndex('sessions', 'by-start', IDBKeyRange.lowerBound(ts));
}

/**
 * Total tracked seconds for each given stable tab key. Reads only the sessions
 * belonging to the requested keys via the `by-key` index — no full-table scan —
 * so cost scales with the number of open tabs, not total history.
 */
export async function getSecondsForKeys(keys: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!keys.length) return map;
  const db = await getDB();
  const tx = db.transaction('sessions', 'readonly');
  const index = tx.objectStore('sessions').index('by-key');
  await Promise.all(
    [...new Set(keys)].map(async (key) => {
      const sessions = await index.getAll(key);
      const total = sessions.reduce((sum, s) => sum + Math.round((s.end - s.start) / 1000), 0);
      if (total) map.set(key, total);
    }),
  );
  await tx.done;
  return map;
}

export async function upsertTabMeta(meta: TabMeta): Promise<void> {
  await (await getDB()).put('tabMeta', meta);
}

export async function getTabMeta(tabId: number): Promise<TabMeta | undefined> {
  return (await getDB()).get('tabMeta', tabId);
}

export async function getAllTabMeta(): Promise<TabMeta[]> {
  return (await getDB()).getAll('tabMeta');
}

export async function removeTabMeta(tabId: number): Promise<void> {
  await (await getDB()).delete('tabMeta', tabId);
}

export async function replaceAllTabMeta(metas: TabMeta[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('tabMeta', 'readwrite');
  await tx.store.clear();
  for (const m of metas) await tx.store.put(m);
  await tx.done;
}

export async function pruneBefore(cutoffDate: string, cutoffTs: number): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['sessions', 'dailyDomainStats'], 'readwrite');
  let cur = await tx.objectStore('sessions').index('by-start').openCursor(IDBKeyRange.upperBound(cutoffTs, true));
  while (cur) {
    await cur.delete();
    cur = await cur.continue();
  }
  let dcur = await tx.objectStore('dailyDomainStats').openCursor(IDBKeyRange.upperBound([cutoffDate, ''], true));
  while (dcur) {
    await dcur.delete();
    dcur = await dcur.continue();
  }
  await tx.done;
}

/**
 * One-time migration: stamp pre-v2 sessions (no tabKey) with the stable key of the
 * still-open tab that owns their tabId. Only sessions whose tabId matches a CURRENT
 * tab are touched, so this is safe — after a browser restart, stale tabIds simply
 * don't match and those legacy sessions stay (correctly) unattributed. Returns the
 * number of sessions updated.
 */
export async function backfillKeylessSessions(tabIdToKey: Map<number, string>): Promise<number> {
  if (!tabIdToKey.size) return 0;
  const db = await getDB();
  const tx = db.transaction('sessions', 'readwrite');
  let updated = 0;
  let cur = await tx.store.openCursor();
  while (cur) {
    if (!cur.value.tabKey) {
      const key = tabIdToKey.get(cur.value.tabId);
      if (key) {
        await cur.update({ ...cur.value, tabKey: key });
        updated++;
      }
    }
    cur = await cur.continue();
  }
  await tx.done;
  return updated;
}

export async function wipeAll(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['sessions', 'dailyDomainStats', 'tabMeta'], 'readwrite');
  await Promise.all([
    tx.objectStore('sessions').clear(),
    tx.objectStore('dailyDomainStats').clear(),
    tx.objectStore('tabMeta').clear(),
  ]);
  await tx.done;
}
