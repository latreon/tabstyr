import { describe, expect, test } from 'vitest';
import { trendTooltip, xTickEvery, yTicks } from '@/lib/chart-scale';

describe('yTicks', () => {
  test('returns 3 nice ticks whose top covers the max', () => {
    const ticks = yTicks(3600); // 1h max
    expect(ticks).toHaveLength(3);
    expect(ticks[2].seconds).toBeGreaterThanOrEqual(3600);
    expect(ticks.map((t) => t.label)).toEqual(['30m', '1h', '1h 30m']);
  });

  test('handles tiny maxima with the smallest step', () => {
    expect(yTicks(0).map((t) => t.label)).toEqual(['5m', '10m', '15m']);
  });

  test('handles huge maxima by falling back to whole hours', () => {
    const ticks = yTicks(20 * 3600);
    expect(ticks[2].seconds).toBeGreaterThanOrEqual(20 * 3600);
  });
});

describe('xTickEvery', () => {
  test('day mode labels every 2nd bar, week/month every bar', () => {
    expect(xTickEvery('day')).toBe(2);
    expect(xTickEvery('week')).toBe(1);
    expect(xTickEvery('month')).toBe(1);
  });
});

describe('trendTooltip', () => {
  test('day mode shows weekday and date', () => {
    expect(trendTooltip('2026-06-11', 'day', 15120)).toBe('Thu, Jun 11 — 4h 12m');
  });
  test('week mode shows week start', () => {
    expect(trendTooltip('2026-06-08', 'week', 3600)).toBe('Week of Mon, Jun 8 — 1h');
  });
  test('month mode shows month name', () => {
    expect(trendTooltip('2026-06', 'month', 60)).toBe('June 2026 — 1m');
  });
});
