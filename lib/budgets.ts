import { CATEGORIES, type Category, type CategorySlice } from './categories';

// Per-category daily time budgets — pure helpers shared by the dashboard (progress
// + "over" markers) and the background nudge. Analytics only: nothing here blocks a
// site, it just measures today's active time against a user-set minute limit.

const SECONDS_PER_MINUTE = 60;

/** Foreground active seconds in a category slice (audio never counts toward a budget). */
export function activeCategorySeconds(slice: { seconds: number; audioSeconds: number }): number {
  return Math.max(0, slice.seconds - slice.audioSeconds);
}

/** Fraction of a category's daily budget used (0–1+, clamped ≥0). 0 when unset. */
export function budgetProgress(
  slice: { seconds: number; audioSeconds: number } | undefined,
  budgetMinutes: number | undefined,
): number {
  if (!budgetMinutes || budgetMinutes <= 0) return 0;
  const active = slice ? activeCategorySeconds(slice) : 0;
  return Math.max(0, active / (budgetMinutes * SECONDS_PER_MINUTE));
}

/**
 * Categories whose today active time has reached or passed their budget. Returned in
 * the canonical CATEGORIES order so the result is stable across calls.
 */
export function exceededBudgets(
  slices: CategorySlice[],
  budgets: Partial<Record<Category, number>>,
): Category[] {
  const byCat = new Map<Category, CategorySlice>(slices.map((s) => [s.category, s]));
  const out: Category[] = [];
  for (const c of CATEGORIES) {
    const budget = budgets[c];
    if (!budget || budget <= 0) continue;
    const active = activeCategorySeconds(byCat.get(c) ?? { seconds: 0, audioSeconds: 0 });
    if (active >= budget * SECONDS_PER_MINUTE) out.push(c);
  }
  return out;
}

/**
 * Whether to fire the once-a-day budget nudge: at least one category is over budget
 * and we haven't already notified today. Budgets reset each calendar day, so — unlike
 * the stale-tab throttle — we deliberately do NOT dedupe against yesterday's
 * categories: crossing a budget again on a new day is a fresh, notify-worthy event.
 */
export function shouldNotifyBudget(exceeded: Category[], lastNotifiedDate: string, today: string): boolean {
  return lastNotifiedDate !== today && exceeded.length > 0;
}
