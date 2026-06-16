import { addDays } from './time';
import { categorize, CATEGORY_PRODUCTIVITY, type Category, type CategoryRule } from './categories';
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
