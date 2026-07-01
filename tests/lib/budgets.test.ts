import { describe, expect, test } from 'vitest';
import { activeCategorySeconds, budgetProgress, exceededBudgets, shouldNotifyBudget } from '@/lib/budgets';
import type { CategorySlice } from '@/lib/categories';

const slice = (category: CategorySlice['category'], seconds: number, audioSeconds = 0): CategorySlice => ({
  category,
  seconds,
  audioSeconds,
});

describe('activeCategorySeconds', () => {
  test('subtracts audio and never goes negative', () => {
    expect(activeCategorySeconds({ seconds: 100, audioSeconds: 30 })).toBe(70);
    expect(activeCategorySeconds({ seconds: 10, audioSeconds: 99 })).toBe(0);
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

  test('excludes audio time from progress', () => {
    expect(budgetProgress(slice('Media', 1800, 1800), 30)).toBe(0); // all audio → 0 active
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

  test('audio-only time does not exceed a budget', () => {
    expect(exceededBudgets([slice('Media', 3600, 3600)], { Media: 30 })).toEqual([]);
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
