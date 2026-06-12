import type { TabMeta } from '../types';

const DAY_MS = 86_400_000;

export function findStale(metas: TabMeta[], now: number, thresholdDays: number): TabMeta[] {
  return metas.filter(
    (m) => now - m.lastActiveAt > thresholdDays * DAY_MS && (!m.snoozedUntil || m.snoozedUntil <= now),
  );
}

export function rematchTabMeta(metas: TabMeta[], liveTabs: Array<{ id: number; url: string }>): TabMeta[] {
  // Group metas by URL (most-recently-active first) so that N live tabs sharing a
  // URL each claim their own meta instead of collapsing onto one.
  const byUrl = new Map<string, TabMeta[]>();
  for (const m of metas) {
    const arr = byUrl.get(m.url);
    if (arr) arr.push(m);
    else byUrl.set(m.url, [m]);
  }
  for (const arr of byUrl.values()) arr.sort((a, b) => b.lastActiveAt - a.lastActiveAt);

  const out: TabMeta[] = [];
  for (const tab of liveTabs) {
    const m = byUrl.get(tab.url)?.shift();
    if (m) out.push({ ...m, tabId: tab.id });
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
