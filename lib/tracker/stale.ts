import type { TabMeta } from '../types';

const DAY_MS = 86_400_000;

export function findStale(metas: TabMeta[], now: number, thresholdDays: number): TabMeta[] {
  return metas.filter(
    (m) => now - m.lastActiveAt > thresholdDays * DAY_MS && (!m.snoozedUntil || m.snoozedUntil <= now),
  );
}

export function rematchTabMeta(metas: TabMeta[], liveTabs: Array<{ id: number; url: string }>): TabMeta[] {
  // When multiple metas share a URL, keep the most recently active one.
  const byUrl = new Map<string, TabMeta>();
  for (const m of metas) {
    const existing = byUrl.get(m.url);
    if (!existing || m.lastActiveAt > existing.lastActiveAt) byUrl.set(m.url, m);
  }
  const out: TabMeta[] = [];
  const used = new Set<string>();
  for (const tab of liveTabs) {
    const m = byUrl.get(tab.url);
    if (m && !used.has(tab.url)) {
      used.add(tab.url);
      out.push({ ...m, tabId: tab.id });
    }
  }
  return out;
}

export function shouldNotify(
  staleIds: number[],
  prevNotifiedIds: number[],
  lastNotifiedDate: string,
  today: string,
): boolean {
  if (lastNotifiedDate === today) return false;
  const prev = new Set(prevNotifiedIds);
  return staleIds.some((id) => !prev.has(id));
}
