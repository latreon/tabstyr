import { peakHour, type HeatmapData } from './heatmap';
import type { Comparison } from './comparison';
import type { Category } from './categories';

// Derives short "insight" lines from data the dashboard already computes (heatmap,
// week comparison, focus summary). Pure: returns structured {key, params} so the UI
// owns all localization/formatting — no vue-i18n, no clock, trivially testable.

export interface Insight {
  /** Stable id (for :key + dedupe). */
  id: string;
  /** i18n key suffix: t(`insights.${key}`, params). */
  key: string;
  /** Interpolation params. `category` is a raw Category key (UI localizes it);
   *  `weekday` is a getDay() index 0–6 (UI localizes); `hour` is 0–23. */
  params: Record<string, string | number>;
}

export interface InsightsInput {
  heatmap: HeatmapData;
  /** Week-over-week comparison (period 'week'). */
  week: Comparison;
  /** Consecutive-day focus streak (0 = none). */
  streakDays: number;
  /** Today's focus %, or null when there's nothing to judge (no prod/distract time). */
  todayFocusPct: number | null;
  focusTarget: number;
}

// A week-over-week category move must clear this to be worth mentioning.
const CATEGORY_SHIFT_MIN_PCT = 15;
// A focus streak is only interesting from a couple of days on.
const STREAK_MIN_DAYS = 2;

/** Weekday (getDay index) with the most total time across the heatmap, or null. */
function busiestWeekday(data: HeatmapData): number | null {
  if (data.total === 0) return null;
  let best = -1;
  let bestSecs = -1;
  for (let day = 0; day < 7; day++) {
    const sum = data.grid[day].reduce((a, b) => a + b, 0);
    if (sum > bestSecs) {
      bestSecs = sum;
      best = day;
    }
  }
  return bestSecs > 0 ? best : null;
}

/** The category with the largest week-over-week % move that has a real baseline. */
function biggestCategoryShift(week: Comparison): { category: Category; pct: number } | null {
  let best: { category: Category; pct: number } | null = null;
  for (const c of week.categories) {
    if (c.deltaPct === null) continue; // no previous baseline → not a "change"
    if (Math.abs(c.deltaPct) < CATEGORY_SHIFT_MIN_PCT) continue;
    if (!best || Math.abs(c.deltaPct) > Math.abs(best.pct)) best = { category: c.category, pct: c.deltaPct };
  }
  return best;
}

/**
 * Build the ordered insight list (most interesting first). Each source is guarded
 * so it only contributes when the data supports it; callers show the top N.
 */
export function buildInsights(input: InsightsInput): Insight[] {
  const out: Insight[] = [];
  const { heatmap, week, streakDays, todayFocusPct, focusTarget } = input;

  // 1. Focus streak.
  if (streakDays >= STREAK_MIN_DAYS) {
    out.push({ id: 'streak', key: 'streak', params: { days: streakDays } });
  }

  // 2. Week-over-week total activity.
  if (week.deltaPct !== null && week.deltaPct !== 0) {
    out.push({
      id: 'week',
      key: week.deltaPct > 0 ? 'weekUp' : 'weekDown',
      params: { pct: Math.abs(week.deltaPct) },
    });
  }

  // 3. Biggest category shift vs last week.
  const shift = biggestCategoryShift(week);
  if (shift) {
    out.push({
      id: 'category',
      key: shift.pct > 0 ? 'catUp' : 'catDown',
      params: { category: shift.category, pct: Math.abs(shift.pct) },
    });
  }

  // 4. Peak hour (specific weekday + hour cell).
  const peak = peakHour(heatmap);
  const busiest = busiestWeekday(heatmap);
  if (peak) {
    out.push({ id: 'peak', key: 'peakHour', params: { hour: peak.hour, weekday: peak.day } });
  }

  // 5. Busiest day of week — skip if it just repeats the peak cell's weekday.
  if (busiest !== null && busiest !== peak?.day) {
    out.push({ id: 'busiest', key: 'busiestDay', params: { weekday: busiest } });
  }

  // 6. Today's focus vs the goal (lowest priority — it's already on the focus tile).
  if (todayFocusPct !== null) {
    out.push(
      todayFocusPct >= focusTarget
        ? { id: 'focus', key: 'focusHit', params: { pct: todayFocusPct, target: focusTarget } }
        : { id: 'focus', key: 'focusUnder', params: { pct: todayFocusPct, target: focusTarget } },
    );
  }

  return out;
}
