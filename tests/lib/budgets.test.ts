import { describe, expect, test } from 'vitest';
import { activeCategorySeconds, budgetProgress, exceededBudgets, shouldNotifyBudget } from '@/lib/budgets';
import type { CategorySlice } from '@/lib/categories';

const slice = (category: CategorySlice['category'], seconds: number, audioSeconds = 0): CategorySlice => ({
  category,
  seconds,
  audioSeconds,
});

describe('activeCategorySeconds', () => {
  test('returns already-active seconds, clamped to zero (audio excluded upstream)', () => {
    expect(activeCategorySeconds({ seconds: 70, audioSeconds: 0 })).toBe(70);
    expect(activeCategorySeconds({ seconds: 70 })).toBe(70); // audioSeconds optional
    expect(activeCategorySeconds({ seconds: -5, audioSeconds: 0 })).toBe(0);
  });
});

describe('budgetProgress', () => {
  test('is 0 when no budget set', () => {
    expect(budgetProgress(slice('Social', 600), undefined)).toBe(0);
    expect(budgetProgress(slice('Social', 600), 0)).toBe(0);
  });

  test('is active-seconds / budget-seconds', () => {
    expect(budgetProgress(slice('Social', 900), 30)).toBeCloseTo(0.5); // 900s of 30m=1800s
    expect(budgetProgress(slice('Social', 1800), 30)).toBeCloseTo(1);
    expect(budgetProgress(slice('Social', 3600), 30)).toBeCloseTo(2);
  });

  test('a category with no active time has zero progress', () => {
    // Audio is excluded upstream, so an all-audio category arrives as 0 active.
    expect(budgetProgress(slice('Media', 0), 30)).toBe(0);
  });
});

describe('exceededBudgets', () => {
  test('flags categories at or past their budget, ignores unset ones', () => {
    const slices = [slice('Social', 1800), slice('Media', 600), slice('Work', 7200)];
    const budgets = { Social: 30, Media: 30 }; // minutes
    // Social 1800s == 30m budget (>= boundary) → exceeded; Media 600s < 1800s → not.
    expect(exceededBudgets(slices, budgets)).toEqual(['Social']);
  });

  test('treats a missing slice as zero active time', () => {
    expect(exceededBudgets([], { Social: 30 })).toEqual([]);
  });

  test('returns categories in canonical order', () => {
    const slices = [slice('Media', 3600), slice('Social', 3600)];
    expect(exceededBudgets(slices, { Social: 1, Media: 1 })).toEqual(['Social', 'Media']);
  });

  test('a category with no active time does not exceed a budget', () => {
    // All-audio time arrives as 0 active (excluded upstream).
    expect(exceededBudgets([slice('Media', 0)], { Media: 30 })).toEqual([]);
  });

  test('flags a custom category keyed by its name', () => {
    const slices = [slice('Gaming', 3600), slice('Social', 60)];
    expect(exceededBudgets(slices, { Gaming: 30, Social: 30 })).toEqual(['Gaming']);
  });

  test('built-ins come first, then custom categories', () => {
    const slices = [slice('Gaming', 3600), slice('Media', 3600), slice('Social', 3600)];
    expect(exceededBudgets(slices, { Gaming: 1, Media: 1, Social: 1 })).toEqual(['Social', 'Media', 'Gaming']);
  });
});

describe('shouldNotifyBudget', () => {
  test('false when already notified today (one nudge per day)', () => {
    expect(shouldNotifyBudget(['Social'], '2026-06-11', '2026-06-11')).toBe(false);
  });

  test('true on a new day when something is over budget — even the same category as yesterday', () => {
    // Budgets reset daily, so re-crossing on a new day is a fresh notify-worthy event.
    expect(shouldNotifyBudget(['Social'], '2026-06-10', '2026-06-11')).toBe(true);
  });

  test('false when nothing is exceeded', () => {
    expect(shouldNotifyBudget([], '', '2026-06-11')).toBe(false);
  });
});
