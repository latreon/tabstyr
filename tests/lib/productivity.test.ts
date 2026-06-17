import { describe, expect, test } from 'vitest';
import { buildFocusTrend, dailyFocus, focusStreak, summarizeProductivity } from '@/lib/productivity';
import type { DailyStat } from '@/lib/types';

const NOW = new Date(2026, 5, 11, 12, 0).getTime(); // 2026-06-11 local

// github → Dev (productive), youtube → Media (distracting), cnn → News (neutral)
function stat(date: string, domain: string, seconds: number): DailyStat {
  return { date, domain, seconds, audioSeconds: 0 };
}

describe('dailyFocus', () => {
  test('splits a day into productive/distracting/neutral and computes focus %', () => {
    const f = dailyFocus([
      stat('2026-06-11', 'github.com', 60),
      stat('2026-06-11', 'youtube.com', 40),
      stat('2026-06-11', 'cnn.com', 100),
    ]).get('2026-06-11')!;
    expect(f.productive).toBe(60);
    expect(f.distracting).toBe(40);
    expect(f.neutral).toBe(100);
    expect(f.total).toBe(200);
    expect(f.focusPct).toBe(60); // 60 / (60 + 40)
  });

  test('focus % is 0 when there is no productive/distracting time', () => {
    expect(dailyFocus([stat('2026-06-11', 'cnn.com', 100)]).get('2026-06-11')!.focusPct).toBe(0);
  });
});

describe('focusStreak', () => {
  const target = 50;

  test('counts consecutive days at or above target, breaking below', () => {
    const map = dailyFocus([
      stat('2026-06-11', 'github.com', 70), stat('2026-06-11', 'youtube.com', 30), // 70%
      stat('2026-06-10', 'github.com', 80), stat('2026-06-10', 'youtube.com', 20), // 80%
      stat('2026-06-09', 'github.com', 40), stat('2026-06-09', 'youtube.com', 60), // 40% → breaks
    ]);
    expect(focusStreak(map, '2026-06-11', target)).toBe(2);
  });

  test('tolerates an empty today without breaking the streak', () => {
    const map = dailyFocus([
      stat('2026-06-11', 'github.com', 70), stat('2026-06-11', 'youtube.com', 30),
      stat('2026-06-10', 'github.com', 90), stat('2026-06-10', 'youtube.com', 10),
    ]);
    // today (06-12) has no data
    expect(focusStreak(map, '2026-06-12', target)).toBe(2);
  });

  test('returns 0 when the latest active day is below target', () => {
    const map = dailyFocus([stat('2026-06-11', 'github.com', 10), stat('2026-06-11', 'youtube.com', 90)]);
    expect(focusStreak(map, '2026-06-11', target)).toBe(0);
  });

  test('a neutral-only day is transparent and does not break the streak', () => {
    const map = dailyFocus([
      stat('2026-06-11', 'github.com', 70), stat('2026-06-11', 'youtube.com', 30), // 70%
      stat('2026-06-10', 'cnn.com', 100), // neutral only → no judgement
      stat('2026-06-09', 'github.com', 80), stat('2026-06-09', 'youtube.com', 20), // 80%
    ]);
    expect(focusStreak(map, '2026-06-11', target)).toBe(2);
  });
});

describe('buildFocusTrend', () => {
  test('day mode returns 10 points ending today with per-day focus %', () => {
    const out = buildFocusTrend(
      [
        stat('2026-06-11', 'github.com', 70), stat('2026-06-11', 'youtube.com', 30), // 70%
        stat('2026-06-10', 'github.com', 40), stat('2026-06-10', 'youtube.com', 60), // 40%
      ],
      'day',
      NOW,
    );
    expect(out).toHaveLength(10);
    expect(out[9]).toMatchObject({ key: '2026-06-11', focusPct: 70, judged: 100 });
    expect(out[8]).toMatchObject({ key: '2026-06-10', focusPct: 40, judged: 100 });
    expect(out[0]).toMatchObject({ focusPct: 0, judged: 0 }); // empty older day
  });

  test('weekly buckets aggregate seconds before computing the ratio', () => {
    // Two days in the most recent week: 90 prod / 30 dist total → 75%, not avg(100%, 50%).
    const out = buildFocusTrend(
      [
        stat('2026-06-11', 'github.com', 60), // 100%
        stat('2026-06-10', 'github.com', 30), stat('2026-06-10', 'youtube.com', 30), // 50%
      ],
      'week',
      NOW,
    );
    expect(out).toHaveLength(8);
    expect(out[7]).toMatchObject({ focusPct: 75, judged: 120 });
  });

  test('respects overrides', () => {
    const out = buildFocusTrend(
      [stat('2026-06-11', 'youtube.com', 60), stat('2026-06-11', 'github.com', 40)],
      'day',
      NOW,
      { 'youtube.com': 'Work' },
    );
    expect(out[9].focusPct).toBe(100);
  });
});

describe('summarizeProductivity', () => {
  test('reports today figures and the streak', () => {
    const stats = [
      stat('2026-06-11', 'github.com', 120), stat('2026-06-11', 'youtube.com', 60),
      stat('2026-06-10', 'github.com', 100), stat('2026-06-10', 'youtube.com', 20),
    ];
    const sum = summarizeProductivity(stats, '2026-06-11');
    expect(sum.todayFocusPct).toBe(67); // 120 / 180
    expect(sum.productiveSeconds).toBe(120);
    expect(sum.distractingSeconds).toBe(60);
    expect(sum.streakDays).toBe(2);
    expect(sum.focusTarget).toBe(50);
  });

  test('respects category overrides', () => {
    // mark youtube as Work (productive) → focus becomes 100%
    const stats = [stat('2026-06-11', 'youtube.com', 60), stat('2026-06-11', 'github.com', 40)];
    const sum = summarizeProductivity(stats, '2026-06-11', { 'youtube.com': 'Work' });
    expect(sum.todayFocusPct).toBe(100);
    expect(sum.distractingSeconds).toBe(0);
  });
});
