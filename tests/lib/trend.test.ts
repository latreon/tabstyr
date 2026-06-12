import { describe, expect, test } from 'vitest';
import { buildTrend } from '@/lib/trend';
import type { DailyStat } from '@/lib/types';

const NOW = new Date(2026, 5, 11, 12, 0).getTime();

function stat(date: string, seconds: number): DailyStat {
  return { date, domain: 'a.com', seconds, audioSeconds: 0 };
}

describe('buildTrend', () => {
  test('day mode returns last 14 days ending today, zero-filled', () => {
    const out = buildTrend([stat('2026-06-11', 100), stat('2026-06-10', 50)], 'day', NOW);
    expect(out).toHaveLength(14);
    expect(out[13]).toEqual({ key: '2026-06-11', label: 'Jun 11', seconds: 100 });
    expect(out[12]).toEqual({ key: '2026-06-10', label: 'Jun 10', seconds: 50 });
    expect(out[0].seconds).toBe(0);
  });

  test('week mode groups 84 days into 12 weekly buckets', () => {
    const out = buildTrend([stat('2026-06-11', 100), stat('2026-06-10', 50)], 'week', NOW);
    expect(out).toHaveLength(12);
    expect(out[11].seconds).toBe(150);
  });

  test('month mode groups the last 90 days by calendar month', () => {
    const out = buildTrend([stat('2026-06-11', 100), stat('2026-05-01', 50)], 'month', NOW);
    const june = out.find((p) => p.key === '2026-06');
    const may = out.find((p) => p.key === '2026-05');
    expect(june?.seconds).toBe(100);
    expect(may?.seconds).toBe(50);
    expect(june?.label).toBe('Jun');
    expect(may?.label).toBe('May');
  });
});
