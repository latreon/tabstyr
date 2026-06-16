import { describe, expect, test } from 'vitest';
import { buildComparison, PERIOD_DAYS } from '@/lib/comparison';
import type { DailyStat } from '@/lib/types';

const stat = (date: string, domain: string, seconds: number): DailyStat => ({
  date,
  domain,
  seconds,
  audioSeconds: 0,
});

// Fixed "today" so windows are deterministic. week = last 7 days incl today.
const TODAY = '2026-06-16';

describe('buildComparison (week)', () => {
  test('splits current vs previous trailing 7-day windows', () => {
    const stats = [
      stat('2026-06-16', 'github.com', 100), // current (today)
      stat('2026-06-10', 'github.com', 50), //  current (today-6, boundary in)
      stat('2026-06-09', 'github.com', 200), // previous (today-7, boundary in)
      stat('2026-06-03', 'github.com', 30), //  previous (today-13, boundary in)
      stat('2026-06-02', 'github.com', 999), // outside both windows
    ];
    const c = buildComparison(stats, TODAY, 'week');
    expect(c.days).toBe(PERIOD_DAYS.week);
    expect(c.currentSeconds).toBe(150);
    expect(c.previousSeconds).toBe(230);
    expect(c.deltaSeconds).toBe(-80);
    expect(c.deltaPct).toBe(-35); // round(-80/230*100)
  });

  test('deltaPct is null when there is no previous baseline', () => {
    const c = buildComparison([stat('2026-06-16', 'github.com', 100)], TODAY, 'week');
    expect(c.currentSeconds).toBe(100);
    expect(c.previousSeconds).toBe(0);
    expect(c.deltaPct).toBeNull();
  });

  test('breaks down by category with per-category deltas, sorted by current', () => {
    const stats = [
      stat('2026-06-16', 'github.com', 120), // Dev current
      stat('2026-06-15', 'youtube.com', 60), // Media current
      stat('2026-06-09', 'github.com', 40), //  Dev previous
      stat('2026-06-08', 'youtube.com', 90), // Media previous
    ];
    const c = buildComparison(stats, TODAY, 'week');
    expect(c.categories[0]).toMatchObject({ category: 'Dev', current: 120, previous: 40, deltaSeconds: 80 });
    const media = c.categories.find((x) => x.category === 'Media');
    expect(media).toMatchObject({ current: 60, previous: 90, deltaSeconds: -30 });
  });

  test('respects category overrides', () => {
    const stats = [stat('2026-06-16', 'example.com', 100)];
    const c = buildComparison(stats, TODAY, 'week', { 'example.com': 'Work' });
    expect(c.categories[0].category).toBe('Work');
  });
});

describe('buildComparison (month)', () => {
  test('uses 30-day windows', () => {
    const stats = [
      stat('2026-06-16', 'github.com', 10), // current
      stat('2026-05-18', 'github.com', 20), // current (today-29 boundary in)
      stat('2026-05-17', 'github.com', 5), //  previous (today-30 boundary in)
    ];
    const c = buildComparison(stats, TODAY, 'month');
    expect(c.days).toBe(30);
    expect(c.currentSeconds).toBe(30);
    expect(c.previousSeconds).toBe(5);
    expect(c.deltaPct).toBe(500);
  });
});
