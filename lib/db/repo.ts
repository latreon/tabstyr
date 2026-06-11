import { getDB } from './db';
import type { DailyStat, Session, TabMeta } from '../types';

export async function addSessions(sessions: Session[]): Promise<void> {
  if (!sessions.length) return;
  const db = await getDB();
  const tx = db.transaction('sessions', 'readwrite');
  for (const s of sessions) await tx.store.add(s);
  await tx.done;
}

export async function applyDailyStats(deltas: DailyStat[]): Promise<void> {
  if (!deltas.length) return;
  const db = await getDB();
  const tx = db.transaction('dailyDomainStats', 'readwrite');
  for (const d of deltas) {
    const existing = await tx.store.get([d.date, d.domain]);
    await tx.store.put(
      existing
        ? {
            ...existing,
            seconds: existing.seconds + d.seconds,
            audioSeconds: existing.audioSeconds + d.audioSeconds,
          }
        : d,
    );
  }
  await tx.done;
}

export async function getStatsRange(from: string, to: string): Promise<DailyStat[]> {
  const db = await getDB();
  return db.getAll('dailyDomainStats', IDBKeyRange.bound([from, ''], [to, '￿']));
}

export async function getSecondsByTab(): Promise<Map<number, number>> {
  const db = await getDB();
  const all = await db.getAll('sessions');
  const map = new Map<number, number>();
  for (const s of all) {
    map.set(s.tabId, (map.get(s.tabId) ?? 0) + Math.round((s.end - s.start) / 1000));
  }
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
