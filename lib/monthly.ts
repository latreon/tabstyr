import type { DailyStat, MonthlyStat } from './types';

/** The local month bucket ('YYYY-MM') a 'YYYY-MM-DD' date key belongs to. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** The 'YYYY-MM' bucket `months` calendar months before the one containing `now`. */
export function monthKeyBefore(now: number, months: number): string {
  const d = new Date(now);
  d.setDate(1); // pin to the 1st first so setMonth can't roll over on a short month
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Aggregate daily per-domain rows into per-domain monthly totals. Pure: used at
 * prune time to archive days leaving the 90-day raw window, and reusable anywhere
 * a set of daily rows must collapse to months. Rows are summed by (month, domain).
 */
export function rollupMonthly(dailies: DailyStat[]): MonthlyStat[] {
  const map = new Map<string, MonthlyStat>();
  for (const d of dailies) {
    const month = monthOf(d.date);
    const key = `${month}|${d.domain}`;
    const cur = map.get(key) ?? { month, domain: d.domain, seconds: 0, audioSeconds: 0 };
    cur.seconds += d.seconds;
    cur.audioSeconds += d.audioSeconds;
    map.set(key, cur);
  }
  return [...map.values()];
}

/**
 * Merge two monthly-stat sets into one, summing by (month, domain). Used to fold a
 * freshly-computed batch into whatever the archive already holds. Never mutates the
 * inputs.
 */
export function mergeMonthly(a: MonthlyStat[], b: MonthlyStat[]): MonthlyStat[] {
  const map = new Map<string, MonthlyStat>();
  for (const m of [...a, ...b]) {
    const key = `${m.month}|${m.domain}`;
    const cur = map.get(key) ?? { month: m.month, domain: m.domain, seconds: 0, audioSeconds: 0 };
    cur.seconds += m.seconds;
    cur.audioSeconds += m.audioSeconds;
    map.set(key, cur);
  }
  return [...map.values()];
}

/**
 * A complete per-domain monthly series over ALL history: the archived months plus
 * the recent (still-raw) daily rows collapsed to months. Because a (date, domain)
 * is deleted from dailyDomainStats the moment it is archived, the two sources are
 * disjoint and simply summing them is correct — no month is ever double-counted,
 * including the boundary month whose older days are archived while its newer days
 * are still raw.
 */
export function combineMonthlyTotals(archive: MonthlyStat[], dailies: DailyStat[]): MonthlyStat[] {
  return mergeMonthly(archive, rollupMonthly(dailies));
}
