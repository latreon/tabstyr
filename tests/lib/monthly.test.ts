import { describe, expect, test } from 'vitest';
import { monthOf, rollupMonthly, mergeMonthly, combineMonthlyTotals } from '@/lib/monthly';
import type { DailyStat, MonthlyStat } from '@/lib/types';

const daily = (p: Partial<DailyStat>): DailyStat => ({ date: '2026-03-01', domain: 'a.com', seconds: 60, audioSeconds: 0, ...p });
const monthly = (p: Partial<MonthlyStat>): MonthlyStat => ({ month: '2026-03', domain: 'a.com', seconds: 60, audioSeconds: 0, ...p });

describe('monthOf', () => {
  test('takes the YYYY-MM prefix of a date key', () => {
    expect(monthOf('2026-03-14')).toBe('2026-03');
  });
});

describe('rollupMonthly', () => {
  test('sums days into one row per (month, domain)', () => {
    const out = rollupMonthly([
      daily({ date: '2026-03-01', seconds: 60 }),
      daily({ date: '2026-03-15', seconds: 40, audioSeconds: 10 }),
      daily({ date: '2026-04-02', seconds: 30 }),
      daily({ date: '2026-03-20', domain: 'b.com', seconds: 25 }),
    ]);
    expect(out).toContainEqual({ month: '2026-03', domain: 'a.com', seconds: 100, audioSeconds: 10 });
    expect(out).toContainEqual({ month: '2026-04', domain: 'a.com', seconds: 30, audioSeconds: 0 });
    expect(out).toContainEqual({ month: '2026-03', domain: 'b.com', seconds: 25, audioSeconds: 0 });
    expect(out).toHaveLength(3);
  });

  test('empty in, empty out', () => {
    expect(rollupMonthly([])).toEqual([]);
  });
});

describe('mergeMonthly', () => {
  test('adds seconds for matching (month, domain) and keeps the rest', () => {
    const out = mergeMonthly(
      [monthly({ seconds: 100 }), monthly({ domain: 'b.com', seconds: 20 })],
      [monthly({ seconds: 50, audioSeconds: 5 }), monthly({ month: '2026-04', seconds: 10 })],
    );
    expect(out).toContainEqual({ month: '2026-03', domain: 'a.com', seconds: 150, audioSeconds: 5 });
    expect(out).toContainEqual({ month: '2026-03', domain: 'b.com', seconds: 20, audioSeconds: 0 });
    expect(out).toContainEqual({ month: '2026-04', domain: 'a.com', seconds: 10, audioSeconds: 0 });
  });

  test('does not mutate its inputs', () => {
    const a = [monthly({ seconds: 100 })];
    const b = [monthly({ seconds: 50 })];
    mergeMonthly(a, b);
    expect(a[0].seconds).toBe(100);
    expect(b[0].seconds).toBe(50);
  });
});

describe('combineMonthlyTotals', () => {
  test('sums archive with the recent daily rows, boundary month included once', () => {
    // Archive holds the older days of the boundary month 2026-03; daily holds its
    // recent days. The two are disjoint by construction, so they simply add.
    const archive = [monthly({ month: '2026-03', seconds: 3600 })];
    const recent = [
      daily({ date: '2026-03-28', seconds: 600 }),
      daily({ date: '2026-04-01', seconds: 120 }),
    ];
    const out = combineMonthlyTotals(archive, recent);
    expect(out).toContainEqual({ month: '2026-03', domain: 'a.com', seconds: 4200, audioSeconds: 0 });
    expect(out).toContainEqual({ month: '2026-04', domain: 'a.com', seconds: 120, audioSeconds: 0 });
  });
});
