import { addDays } from './time';
import { categorize, type Category } from './categories';
import type { DailyStat } from './types';

export type ComparePeriod = 'week' | 'month';

export const PERIOD_DAYS: Record<ComparePeriod, number> = { week: 7, month: 30 };

export interface CategoryDelta {
  category: Category;
  current: number;
  previous: number;
  deltaSeconds: number;
  deltaPct: number | null; // null when previous is 0 (no baseline to compare)
}

export interface Comparison {
  period: ComparePeriod;
  days: number;
  currentSeconds: number;
  previousSeconds: number;
  deltaSeconds: number;
  deltaPct: number | null; // null when previous is 0
  categories: CategoryDelta[]; // sorted by current time desc, then previous desc
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Inclusive set of YYYY-MM-DD keys ending at `end`, going back `days` days. */
function windowKeys(end: string, days: number): Set<string> {
  return new Set(Array.from({ length: days }, (_, i) => addDays(end, -i)));
}

/**
 * Compare a trailing window (current) against the equally-sized window right
 * before it (previous). `stats` should already be the active web-only daily
 * rows (see useStats.activeStats). Categorization respects user overrides.
 *
 * week  → last 7 days vs the previous 7 days.
 * month → last 30 days vs the previous 30 days.
 *
 * The current window includes today, which is still in progress — labels in the
 * UI make the "so far" nature explicit.
 */
export function buildComparison(
  stats: DailyStat[],
  todayKey: string,
  period: ComparePeriod,
  overrides: Record<string, Category> = {},
): Comparison {
  const days = PERIOD_DAYS[period];
  const currentDays = windowKeys(todayKey, days);
  const previousDays = windowKeys(addDays(todayKey, -days), days);

  let currentSeconds = 0;
  let previousSeconds = 0;
  // Per-category totals for each window.
  const cur = new Map<Category, number>();
  const prev = new Map<Category, number>();

  for (const s of stats) {
    const inCurrent = currentDays.has(s.date);
    const inPrevious = previousDays.has(s.date);
    if (!inCurrent && !inPrevious) continue;
    const cat = categorize(s.domain, overrides);
    if (inCurrent) {
      currentSeconds += s.seconds;
      cur.set(cat, (cur.get(cat) ?? 0) + s.seconds);
    } else {
      previousSeconds += s.seconds;
      prev.set(cat, (prev.get(cat) ?? 0) + s.seconds);
    }
  }

  const categories: CategoryDelta[] = [...new Set([...cur.keys(), ...prev.keys()])]
    .map((category) => {
      const current = cur.get(category) ?? 0;
      const previous = prev.get(category) ?? 0;
      return { category, current, previous, deltaSeconds: current - previous, deltaPct: pctChange(current, previous) };
    })
    .sort((a, b) => b.current - a.current || b.previous - a.previous);

  return {
    period,
    days,
    currentSeconds,
    previousSeconds,
    deltaSeconds: currentSeconds - previousSeconds,
    deltaPct: pctChange(currentSeconds, previousSeconds),
    categories,
  };
}
