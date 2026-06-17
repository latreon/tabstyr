import { addDays, dateKey, dayLabel, monthLabel } from './time';
import { categorize, CATEGORY_PRODUCTIVITY, type Category, type CategoryRule } from './categories';
import type { TrendMode } from './trend';
import type { DailyStat } from './types';

export interface DayFocus {
  date: string;
  productive: number;
  distracting: number;
  neutral: number;
  total: number;
  /** productive / (productive + distracting), 0–100. Neutral time is ignored. */
  focusPct: number;
}

export function dailyFocus(
  stats: DailyStat[],
  overrides: Record<string, Category> = {},
  rules: readonly CategoryRule[] = [],
): Map<string, DayFocus> {
  const byDate = new Map<string, DayFocus>();
  for (const s of stats) {
    const f =
      byDate.get(s.date) ?? { date: s.date, productive: 0, distracting: 0, neutral: 0, total: 0, focusPct: 0 };
    f[CATEGORY_PRODUCTIVITY[categorize(s.domain, overrides, rules)]] += s.seconds;
    f.total += s.seconds;
    byDate.set(s.date, f);
  }
  for (const f of byDate.values()) {
    const denom = f.productive + f.distracting;
    f.focusPct = denom ? Math.round((f.productive / denom) * 100) : 0;
  }
  return byDate;
}

/**
 * Consecutive days (ending today) whose focus % meets the target. Today may be
 * empty (the day just started) without breaking the streak; any later gap or a
 * below-target day ends it.
 */
export function focusStreak(byDate: Map<string, DayFocus>, todayKey: string, target: number): number {
  let streak = 0;
  let cursor = todayKey;
  let allowEmpty = true; // tolerate an empty "today"
  for (let i = 0; i < 400; i++) {
    const f = byDate.get(cursor);
    if (!f || f.total === 0) {
      if (allowEmpty) {
        allowEmpty = false;
        cursor = addDays(cursor, -1);
        continue;
      }
      break;
    }
    allowEmpty = false;
    // A day spent only on neutral sites (no productive or distracting time) has
    // nothing to judge — treat it as transparent so it neither breaks nor extends
    // the streak rather than scoring it 0% and resetting unfairly.
    if (f.productive + f.distracting === 0) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (f.focusPct >= target) {
      streak++;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}

export interface ProductivitySummary {
  todayFocusPct: number;
  productiveSeconds: number;
  distractingSeconds: number;
  neutralSeconds: number;
  streakDays: number;
  focusTarget: number;
}

export interface FocusPoint {
  key: string; // YYYY-MM-DD (day/week start) or YYYY-MM (month)
  label: string;
  focusPct: number; // 0–100; 0 when there's nothing to judge
  judged: number; // productive + distracting seconds; 0 => no scoreable time that period
  partial?: boolean; // month bucket only partly inside the window
}

function focusRangeDays(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(today, i - (count - 1)));
}

const scoreFocus = (productive: number, distracting: number) => {
  const judged = productive + distracting;
  return { focusPct: judged ? Math.round((productive / judged) * 100) : 0, judged };
};

/**
 * Focus % over time — the same day/week/month windows as the activity trend, but
 * each bar is `productive / (productive + distracting)` aggregated across the
 * bucket's days (neutral time ignored). Weekly/monthly buckets sum the underlying
 * seconds first, so they reflect real ratios rather than an average of percentages.
 */
export function buildFocusTrend(
  stats: DailyStat[],
  mode: TrendMode,
  now: number,
  overrides: Record<string, Category> = {},
  rules: readonly CategoryRule[] = [],
): FocusPoint[] {
  const byDate = dailyFocus(stats, overrides, rules);
  const today = dateKey(now);

  if (mode === 'day') {
    return focusRangeDays(today, 10).map((d) => {
      const f = byDate.get(d);
      return { key: d, label: dayLabel(d), ...scoreFocus(f?.productive ?? 0, f?.distracting ?? 0) };
    });
  }
  if (mode === 'week') {
    const days = focusRangeDays(today, 56);
    const out: FocusPoint[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      let p = 0;
      let dist = 0;
      for (const d of chunk) {
        const f = byDate.get(d);
        p += f?.productive ?? 0;
        dist += f?.distracting ?? 0;
      }
      out.push({ key: chunk[0], label: dayLabel(chunk[0]), ...scoreFocus(p, dist) });
    }
    return out;
  }
  const days = focusRangeDays(today, 60);
  const startPartial = !days[0].endsWith('-01');
  const firstMonth = days[0].slice(0, 7);
  const lastMonth = today.slice(0, 7);
  const months = new Map<string, { p: number; dist: number }>();
  for (const d of days) {
    const key = d.slice(0, 7);
    const f = byDate.get(d);
    const m = months.get(key) ?? { p: 0, dist: 0 };
    m.p += f?.productive ?? 0;
    m.dist += f?.distracting ?? 0;
    months.set(key, m);
  }
  return [...months.entries()].map(([key, m]) => ({
    key,
    label: monthLabel(key),
    ...scoreFocus(m.p, m.dist),
    partial: (key === firstMonth && startPartial) || key === lastMonth,
  }));
}

export function summarizeProductivity(
  stats: DailyStat[],
  todayKey: string,
  overrides: Record<string, Category> = {},
  rules: readonly CategoryRule[] = [],
  focusTarget = 50,
): ProductivitySummary {
  const byDate = dailyFocus(stats, overrides, rules);
  const today = byDate.get(todayKey);
  return {
    todayFocusPct: today?.focusPct ?? 0,
    productiveSeconds: today?.productive ?? 0,
    distractingSeconds: today?.distracting ?? 0,
    neutralSeconds: today?.neutral ?? 0,
    streakDays: focusStreak(byDate, todayKey, focusTarget),
    focusTarget,
  };
}
