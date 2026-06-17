import type { TabMeta } from '../types';
import { domainOf } from '../domain';

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

  // Domain-level fallback: session restore can alter a URL slightly (dropped
  // fragment, trailing slash, redirect), which would orphan an exact-URL match
  // and lose that tab's stable key + history. Match leftovers by domain so the
  // key survives a cold restart. Exact-URL matches always win first.
  const byDomain = new Map<string, TabMeta[]>();
  for (const m of metas) {
    const domain = domainOf(m.url);
    const arr = byDomain.get(domain);
    if (arr) arr.push(m);
    else byDomain.set(domain, [m]);
  }
  for (const arr of byDomain.values()) arr.sort((a, b) => b.lastActiveAt - a.lastActiveAt);

  const claimed = new Set<TabMeta>();
  const out: TabMeta[] = [];
  for (const tab of liveTabs) {
    let m = byUrl.get(tab.url)?.shift();
    if (m) claimed.add(m);
    if (!m) {
      // Take the next unclaimed meta on the same domain, if any.
      const pool = byDomain.get(domainOf(tab.url));
      while (pool?.length && claimed.has(pool[0])) pool.shift();
      m = pool?.shift();
      if (m) claimed.add(m);
    }
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
