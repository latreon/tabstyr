import { describe, expect, test } from 'vitest';
import { buildWrapped, type WrappedInput } from '@/lib/wrapped';
import type { DailyStat, Session } from '@/lib/types';

// ── builders ────────────────────────────────────────────────────────────────
function stat(date: string, domain: string, seconds: number, audioSeconds = 0): DailyStat {
  return { date, domain, seconds, audioSeconds };
}
// A foreground session at a given local hour on a date, `mins` long.
function session(date: [number, number, number], hour: number, mins: number, domain = 'github.com'): Session {
  const [y, m, d] = date;
  const start = new Date(y, m - 1, d, hour, 0, 0).getTime();
  return {
    tabId: 1,
    tabKey: 'k',
    url: `https://${domain}/`,
    domain,
    start,
    end: start + mins * 60_000,
    audio: false,
  };
}
const build = (input: Partial<WrappedInput>) =>
  buildWrapped({ dailyStats: [], sessions: [], ...input });

// ── empty / not-enough-data ──────────────────────────────────────────────────
describe('buildWrapped — empty states', () => {
  test('returns null with no data', () => {
    expect(build({})).toBeNull();
  });

  test('returns null when all time is background audio (zero active)', () => {
    // seconds === audioSeconds → activeSeconds is 0
    expect(build({ dailyStats: [stat('2026-06-01', 'open.spotify.com', 600, 600)] })).toBeNull();
  });
});

// ── headline totals ──────────────────────────────────────────────────────────
describe('buildWrapped — totals', () => {
  test('sums active foreground seconds and separates audio', () => {
    const w = build({
      dailyStats: [
        stat('2026-06-01', 'github.com', 300, 0),
        stat('2026-06-01', 'open.spotify.com', 200, 200), // pure audio → 0 active
        stat('2026-06-02', 'youtube.com', 600, 120), // 480 active, 120 audio
      ],
    })!;
    expect(w).not.toBeNull();
    expect(w.totalSeconds).toBe(300 + 480);
    expect(w.totalAudioSeconds).toBe(320);
  });

  test('daily average divides by days that had activity', () => {
    const w = build({
      dailyStats: [stat('2026-06-01', 'github.com', 400), stat('2026-06-03', 'github.com', 200)],
    })!;
    expect(w.daysCovered).toBe(2);
    expect(w.dailyAverageSeconds).toBe(300);
  });
});

// ── coverage window ──────────────────────────────────────────────────────────
describe('buildWrapped — coverage window', () => {
  test('start/end/daysCovered/spanDays reflect active dates only', () => {
    const w = build({
      dailyStats: [
        stat('2026-06-10', 'github.com', 100),
        stat('2026-06-01', 'github.com', 100),
        stat('2026-06-05', 'open.spotify.com', 50, 50), // audio-only: not an active date
      ],
    })!;
    expect(w.startDate).toBe('2026-06-01');
    expect(w.endDate).toBe('2026-06-10');
    expect(w.daysCovered).toBe(2);
    expect(w.spanDays).toBe(10);
  });
});

// ── sites ────────────────────────────────────────────────────────────────────
describe('buildWrapped — sites', () => {
  test('ranks domains by active time, strips www for the label, keeps real domain', () => {
    const w = build({
      dailyStats: [
        stat('2026-06-01', 'www.github.com', 100),
        stat('2026-06-02', 'www.github.com', 500),
        stat('2026-06-01', 'x.com', 200),
      ],
    })!;
    expect(w.topSite!.domain).toBe('www.github.com');
    expect(w.topSite!.label).toBe('github.com');
    expect(w.topSite!.seconds).toBe(600);
    expect(w.distinctDomains).toBe(2);
  });

  test('caps topSites at 5', () => {
    const stats = Array.from({ length: 8 }, (_, i) => stat('2026-06-01', `site${i}.com`, (i + 1) * 10));
    const w = build({ dailyStats: stats })!;
    expect(w.topSites).toHaveLength(5);
    expect(w.topSites[0].seconds).toBe(80); // site7 highest
  });
});

// ── categories ───────────────────────────────────────────────────────────────
describe('buildWrapped — categories', () => {
  test('groups by category with rounded percentage shares', () => {
    const w = build({
      dailyStats: [stat('2026-06-01', 'github.com', 750), stat('2026-06-01', 'x.com', 250)],
    })!;
    expect(w.topCategory!.category).toBe('Dev');
    expect(w.topCategory!.pct).toBe(75);
    const social = w.categories.find((c) => c.category === 'Social')!;
    expect(social.pct).toBe(25);
  });

  test('honours user overrides', () => {
    const w = build({
      dailyStats: [stat('2026-06-01', 'mysite.example', 500)],
      overrides: { 'mysite.example': 'Work' },
    })!;
    expect(w.topCategory!.category).toBe('Work');
  });
});

// ── focus ────────────────────────────────────────────────────────────────────
describe('buildWrapped — focus', () => {
  test('focus % = productive ÷ (productive + distracting), neutral ignored', () => {
    const w = build({
      dailyStats: [
        stat('2026-06-01', 'github.com', 300), // productive
        stat('2026-06-01', 'x.com', 100), // distracting
        stat('2026-06-01', 'example.com', 999), // neutral → ignored in ratio
      ],
    })!;
    expect(w.productiveSeconds).toBe(300);
    expect(w.distractingSeconds).toBe(100);
    expect(w.focusPct).toBe(75);
  });

  test('longest streak counts consecutive judged days at/above target, skipping empty days', () => {
    const w = build({
      dailyStats: [
        stat('2026-06-01', 'github.com', 100), // ✓
        stat('2026-06-02', 'github.com', 100), // ✓
        stat('2026-06-03', 'github.com', 100), // ✓  (run of 3)
        stat('2026-06-04', 'x.com', 100), // ✗ below target → breaks
        stat('2026-06-05', 'github.com', 100), // ✓
        // 2026-06-06 has no data → transparent (does not break)
        stat('2026-06-07', 'github.com', 100), // ✓  (run of 2 across the gap)
      ],
    })!;
    expect(w.longestStreak).toBe(3);
  });
});

// ── time of day ──────────────────────────────────────────────────────────────
describe('buildWrapped — time of day', () => {
  test('peak is null and chronotype allHours when there are no sessions', () => {
    const w = build({ dailyStats: [stat('2026-06-01', 'github.com', 100)] })!;
    expect(w.peak).toBeNull();
    expect(w.chronotype).toBe('allHours');
  });

  test('morning-heavy sessions yield an early bird', () => {
    const w = build({
      dailyStats: [stat('2026-06-01', 'github.com', 100)],
      sessions: [session([2026, 6, 1], 7, 60), session([2026, 6, 1], 8, 60), session([2026, 6, 1], 9, 60)],
    })!;
    expect(w.chronotype).toBe('earlyBird');
    expect(w.peak).not.toBeNull();
  });

  test('late-night sessions yield a night owl', () => {
    const w = build({
      dailyStats: [stat('2026-06-01', 'github.com', 100)],
      sessions: [session([2026, 6, 1], 23, 60), session([2026, 6, 2], 1, 60), session([2026, 6, 2], 2, 60)],
    })!;
    expect(w.chronotype).toBe('nightOwl');
  });
});

// ── busiest day ──────────────────────────────────────────────────────────────
describe('buildWrapped — busiest day', () => {
  test('finds the date with the most active time', () => {
    const w = build({
      dailyStats: [
        stat('2026-06-01', 'github.com', 100),
        stat('2026-06-02', 'github.com', 300),
        stat('2026-06-02', 'x.com', 100),
      ],
    })!;
    expect(w.busiestDate).toBe('2026-06-02');
    expect(w.busiestDateSeconds).toBe(400);
  });
});

// ── visits ───────────────────────────────────────────────────────────────────
describe('buildWrapped — visits', () => {
  test('coalesces foreground sessions into visits and finds the longest', () => {
    const w = build({
      dailyStats: [stat('2026-06-01', 'github.com', 100)],
      // two 60-min sessions ~10 min apart coalesce? gap is 60min > 90s → separate visits
      sessions: [session([2026, 6, 1], 9, 60), session([2026, 6, 1], 14, 30)],
    })!;
    expect(w.visitCount).toBe(2);
    expect(w.longestVisitSeconds).toBe(60 * 60);
  });
});

// ── persona ──────────────────────────────────────────────────────────────────
describe('buildWrapped — persona', () => {
  test('a dominant Dev category makes a builder', () => {
    const w = build({
      dailyStats: [stat('2026-06-01', 'github.com', 500), stat('2026-06-01', 'x.com', 100)],
    })!;
    expect(w.persona).toEqual({ id: 'builder', category: 'Dev' });
  });

  test('a diffuse mix with no dominant category makes an explorer', () => {
    const w = build({
      dailyStats: [
        stat('2026-06-01', 'github.com', 100), // Dev
        stat('2026-06-01', 'x.com', 100), // Social
        stat('2026-06-01', 'youtube.com', 100), // Media
        stat('2026-06-01', 'example.com', 100), // Other
      ],
    })!;
    expect(w.persona).toEqual({ id: 'explorer', category: null });
  });
});
