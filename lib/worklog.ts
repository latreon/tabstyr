import { formatDuration, longDateLabel } from './time';
import { isWebDomain } from './domain';
import { categorize, groupByCategory, type CategoryId, type CategoryRule, type CategorySlice } from './categories';
import type { DailyStat } from './types';

interface WorkLogDomain {
  domain: string;
  seconds: number;
  audioSeconds: number;
  category: CategoryId;
}

export interface WorkLog {
  date: string;
  total: number;
  categories: CategorySlice[];
  domains: WorkLogDomain[];
}

/**
 * What was tracked on a single day: total, per-category breakdown, and the
 * per-site list (web domains only — internal pages aren't useful for a log).
 */
export function buildWorkLog(
  stats: DailyStat[],
  date: string,
  overrides: Record<string, CategoryId> = {},
  rules: readonly CategoryRule[] = [],
): WorkLog {
  const day = stats.filter((s) => s.date === date && isWebDomain(s.domain));
  const total = day.reduce((sum, s) => sum + s.seconds, 0);
  const categories = groupByCategory(day, overrides, rules);
  const domains = day
    .map((s) => ({
      domain: s.domain,
      seconds: s.seconds,
      audioSeconds: s.audioSeconds,
      category: categorize(s.domain, overrides, rules),
    }))
    .sort((a, b) => b.seconds - a.seconds);
  return { date, total, categories, domains };
}

/** Plain-text summary suitable for pasting into a standup note or invoice. */
export function workLogText(log: WorkLog): string {
  const lines = [`${longDateLabel(log.date)} — ${formatDuration(log.total)}`];
  if (!log.total) {
    lines.push('No activity tracked.');
    return lines.join('\n');
  }
  lines.push('');
  for (const d of log.domains) lines.push(`• ${d.domain} — ${formatDuration(d.seconds)}`);
  return lines.join('\n');
}
