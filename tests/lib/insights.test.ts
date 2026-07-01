import { describe, expect, test } from 'vitest';
import { buildInsights, type InsightsInput } from '@/lib/insights';
import type { HeatmapData } from '@/lib/heatmap';
import type { Comparison } from '@/lib/comparison';

function emptyGrid(): number[][] {
  return Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
}
function heatmap(cells: Array<[day: number, hour: number, secs: number]> = []): HeatmapData {
  const grid = emptyGrid();
  let total = 0;
  let max = 1;
  for (const [d, h, s] of cells) {
    grid[d][h] += s;
    total += s;
    if (grid[d][h] > max) max = grid[d][h];
  }
  return { grid, max, total };
}
function comparison(over: Partial<Comparison> = {}): Comparison {
  return {
    period: 'week',
    days: 7,
    currentSeconds: 0,
    previousSeconds: 0,
    deltaSeconds: 0,
    deltaPct: null,
    categories: [],
    ...over,
  };
}
function input(over: Partial<InsightsInput> = {}): InsightsInput {
  return { heatmap: heatmap(), week: comparison(), streakDays: 0, todayFocusPct: null, focusTarget: 50, ...over };
}

const ids = (input: InsightsInput) => buildInsights(input).map((i) => i.id);

describe('buildInsights', () => {
  test('returns nothing when there is no data', () => {
    expect(buildInsights(input())).toEqual([]);
  });

  test('reports a focus streak only from 2 days up', () => {
    expect(ids(input({ streakDays: 1 }))).not.toContain('streak');
    const streak = buildInsights(input({ streakDays: 4 })).find((i) => i.id === 'streak');
    expect(streak).toEqual({ id: 'streak', key: 'streak', params: { days: 4 } });
  });

  test('week activity up/down with absolute pct, skips 0%', () => {
    expect(buildInsights(input({ week: comparison({ deltaPct: 20 }) }))[0]).toMatchObject({
      key: 'weekUp',
      params: { pct: 20 },
    });
    expect(buildInsights(input({ week: comparison({ deltaPct: -35 }) }))[0]).toMatchObject({
      key: 'weekDown',
      params: { pct: 35 },
    });
    expect(ids(input({ week: comparison({ deltaPct: 0 }) }))).not.toContain('week');
  });

  test('picks the biggest category shift above threshold, ignores null baselines & small moves', () => {
    const week = comparison({
      categories: [
        { category: 'Social', current: 100, previous: 50, deltaSeconds: 50, deltaPct: 100 },
        { category: 'Dev', current: 90, previous: 100, deltaSeconds: -10, deltaPct: -10 }, // below 15% → ignored
        { category: 'News', current: 10, previous: 0, deltaSeconds: 10, deltaPct: null }, // no baseline → ignored
      ],
    });
    const cat = buildInsights(input({ week })).find((i) => i.id === 'category');
    expect(cat).toEqual({ id: 'category', key: 'catUp', params: { category: 'Social', pct: 100 } });
  });

  test('peak hour insight carries weekday index + hour', () => {
    const peak = buildInsights(input({ heatmap: heatmap([[3, 14, 600]]) })).find((i) => i.id === 'peak');
    expect(peak).toEqual({ id: 'peak', key: 'peakHour', params: { hour: 14, weekday: 3 } });
  });

  test('busiest weekday is suppressed when it equals the peak cell weekday', () => {
    // Single day (Wed=3) has all the time → peak.day === busiest → only one appears.
    const list = buildInsights(input({ heatmap: heatmap([[3, 14, 600], [3, 9, 120]]) }));
    expect(list.filter((i) => i.id === 'busiest')).toHaveLength(0);
    expect(list.some((i) => i.id === 'peak')).toBe(true);
  });

  test('busiest weekday appears when it differs from the peak weekday', () => {
    // Peak cell is Mon 09:00 (500), but Tue has more total (300+300=600).
    const list = buildInsights(input({ heatmap: heatmap([[1, 9, 500], [2, 10, 300], [2, 11, 300]]) }));
    const busiest = list.find((i) => i.id === 'busiest');
    expect(busiest).toEqual({ id: 'busiest', key: 'busiestDay', params: { weekday: 2 } });
  });

  test('focus vs goal: hit when at/above target, under otherwise; skipped when null', () => {
    expect(buildInsights(input({ todayFocusPct: 70, focusTarget: 50 })).find((i) => i.id === 'focus')).toMatchObject({
      key: 'focusHit',
    });
    expect(buildInsights(input({ todayFocusPct: 30, focusTarget: 50 })).find((i) => i.id === 'focus')).toMatchObject({
      key: 'focusUnder',
    });
    expect(ids(input({ todayFocusPct: null }))).not.toContain('focus');
  });

  test('orders streak, week, category ahead of peak/busiest/focus', () => {
    const week = comparison({
      deltaPct: 20,
      categories: [{ category: 'Social', current: 100, previous: 40, deltaSeconds: 60, deltaPct: 150 }],
    });
    const list = ids(input({ streakDays: 3, week, heatmap: heatmap([[1, 9, 500]]), todayFocusPct: 60 }));
    expect(list).toEqual(['streak', 'week', 'category', 'peak', 'focus']);
  });
});
