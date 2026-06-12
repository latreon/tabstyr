import { describe, expect, test } from 'vitest';
import { buildHourlyHeatmap, peakHour } from '@/lib/heatmap';

// Build with local-time anchored timestamps; derive expected day/hour from the same
// Date so the assertions hold regardless of the runner's timezone.
function at(y: number, mo: number, d: number, h: number, mi = 0): number {
  return new Date(y, mo, d, h, mi, 0, 0).getTime();
}

describe('buildHourlyHeatmap', () => {
  test('buckets a session that stays within one hour', () => {
    const start = at(2026, 5, 11, 10, 15);
    const data = buildHourlyHeatmap([{ start, end: start + 30 * 60_000 }]);
    const d = new Date(start);
    expect(data.grid[d.getDay()][10]).toBe(1800);
    expect(data.total).toBe(1800);
    expect(data.max).toBe(1800);
  });

  test('splits a session across an hour boundary', () => {
    const start = at(2026, 5, 11, 10, 45);
    const data = buildHourlyHeatmap([{ start, end: start + 30 * 60_000 }]); // 10:45–11:15
    const dow = new Date(start).getDay();
    expect(data.grid[dow][10]).toBe(900);
    expect(data.grid[dow][11]).toBe(900);
    expect(data.total).toBe(1800);
  });

  test('splits a session across midnight into two weekdays', () => {
    const start = at(2026, 5, 11, 23, 50);
    const data = buildHourlyHeatmap([{ start, end: start + 20 * 60_000 }]); // 23:50–00:10
    const dayA = new Date(start).getDay();
    const dayB = new Date(start + 20 * 60_000).getDay();
    expect(data.grid[dayA][23]).toBe(600);
    expect(data.grid[dayB][0]).toBe(600);
    expect(dayB).toBe((dayA + 1) % 7);
  });

  test('accumulates multiple sessions into the same cell', () => {
    const start = at(2026, 5, 11, 9, 0);
    const data = buildHourlyHeatmap([
      { start, end: start + 10 * 60_000 },
      { start: start + 20 * 60_000, end: start + 35 * 60_000 },
    ]);
    const dow = new Date(start).getDay();
    expect(data.grid[dow][9]).toBe(1500); // 600 + 900
  });

  test('empty input yields a zeroed grid with a safe max', () => {
    const data = buildHourlyHeatmap([]);
    expect(data.total).toBe(0);
    expect(data.max).toBe(1);
    expect(data.grid).toHaveLength(7);
    expect(data.grid[0]).toHaveLength(24);
  });
});

describe('peakHour', () => {
  test('returns the busiest cell', () => {
    const start = at(2026, 5, 11, 14, 0);
    const data = buildHourlyHeatmap([
      { start, end: start + 60 * 60_000 }, // 1h at hour 14
      { start: at(2026, 5, 12, 9, 0), end: at(2026, 5, 12, 9, 30) }, // 30m at hour 9
    ]);
    const p = peakHour(data);
    expect(p?.hour).toBe(14);
    expect(p?.seconds).toBe(3600);
  });

  test('returns null for an empty grid', () => {
    expect(peakHour(buildHourlyHeatmap([]))).toBeNull();
  });
});
