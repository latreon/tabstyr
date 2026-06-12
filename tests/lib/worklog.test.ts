import { describe, expect, test } from 'vitest';
import { buildWorkLog, workLogText } from '@/lib/worklog';
import type { DailyStat } from '@/lib/types';

function stat(date: string, domain: string, seconds: number, audioSeconds = 0): DailyStat {
  return { date, domain, seconds, audioSeconds };
}

const STATS: DailyStat[] = [
  stat('2026-06-11', 'github.com', 3600),
  stat('2026-06-11', 'youtube.com', 1800),
  stat('2026-06-11', 'gitlab.com', 600),
  stat('2026-06-11', 'chrome', 999), // internal — excluded
  stat('2026-06-10', 'github.com', 120), // other day
];

describe('buildWorkLog', () => {
  test('includes only the chosen day and web domains, sorted by time', () => {
    const log = buildWorkLog(STATS, '2026-06-11');
    expect(log.total).toBe(6000); // 3600 + 1800 + 600, chrome excluded
    expect(log.domains.map((d) => d.domain)).toEqual(['github.com', 'youtube.com', 'gitlab.com']);
    expect(log.domains[0].category).toBe('Dev');
  });

  test('groups categories (Dev = github + gitlab) and sorts them', () => {
    const log = buildWorkLog(STATS, '2026-06-11');
    expect(log.categories[0]).toEqual({ category: 'Dev', seconds: 4200, audioSeconds: 0 });
    expect(log.categories.find((c) => c.category === 'Media')?.seconds).toBe(1800);
  });

  test('respects category overrides', () => {
    const log = buildWorkLog(STATS, '2026-06-11', { 'youtube.com': 'Work' });
    expect(log.domains.find((d) => d.domain === 'youtube.com')?.category).toBe('Work');
  });

  test('empty day yields zero total and no rows', () => {
    const log = buildWorkLog(STATS, '2026-01-01');
    expect(log.total).toBe(0);
    expect(log.domains).toEqual([]);
  });
});

describe('workLogText', () => {
  test('renders a pasteable summary: heading total + one line per site', () => {
    const text = workLogText(buildWorkLog(STATS, '2026-06-11'));
    expect(text).toContain('— 1h 40m');
    expect(text).toContain('• github.com — 1h');
    expect(text).toContain('• youtube.com — 30m');
    expect(text).not.toContain('By category'); // simplified — no category section
  });

  test('reports an empty day clearly', () => {
    const text = workLogText(buildWorkLog(STATS, '2026-01-01'));
    expect(text).toContain('No activity tracked.');
  });
});
