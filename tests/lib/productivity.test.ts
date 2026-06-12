import { describe, expect, test } from 'vitest';
import { dailyFocus, focusStreak, summarizeProductivity } from '@/lib/productivity';
import type { DailyStat } from '@/lib/types';

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
