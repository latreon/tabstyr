import { describe, expect, test } from 'vitest';
import { summaryBody, summaryMailto, summarySubject } from '@/lib/email-summary';
import type { ReportData } from '@/lib/report';

function report(overrides: Partial<ReportData> = {}): ReportData {
  return {
    from: '2026-07-06',
    to: '2026-07-12',
    days: 7,
    totalSeconds: 3600,
    categories: [{ category: 'Dev', seconds: 3600, audioSeconds: 0 }],
    domains: [{ domain: 'github.com', seconds: 3600, category: 'Dev' }],
    ...overrides,
  };
}

describe('summarySubject', () => {
  test('a multi-day range reads as "from to to"', () => {
    expect(summarySubject(report(), 'weekly')).toBe('TabStyr weekly summary — 2026-07-06 to 2026-07-12');
  });

  test('a single day (from === to) shows one date, no "to"', () => {
    const r = report({ from: '2026-07-12', to: '2026-07-12', days: 1 });
    expect(summarySubject(r, 'daily')).toBe('TabStyr daily summary — 2026-07-12');
  });
});

describe('summaryBody', () => {
  test('includes total, category breakdown, and top sites', () => {
    const body = summaryBody(report());
    expect(body).toContain('Total active time: 1h 0m');
    expect(body).toContain('Dev: 1h 0m');
    expect(body).toContain('github.com: 1h 0m');
  });

  test('lists at most 8 domains and notes how many more were dropped', () => {
    const domains = Array.from({ length: 12 }, (_, i) => ({
      domain: `site${i}.com`,
      seconds: 100 - i,
      category: 'Other',
    }));
    const body = summaryBody(report({ domains }));
    expect(body).toContain('site0.com');
    expect(body).toContain('site7.com');
    expect(body).not.toContain('site8.com');
    expect(body).toContain('…and 4 more');
  });

  test('never claims TabStyr sends the data itself', () => {
    expect(summaryBody(report())).toContain('you\'re sending it yourself');
  });

  test('caps body length even for a pathologically large report', () => {
    const domains = Array.from({ length: 8 }, (_, i) => ({
      domain: `a-very-long-domain-name-example-${i}.example.com`,
      seconds: 100,
      category: 'Other',
    }));
    const categories = Array.from({ length: 50 }, (_, i) => ({
      category: `Custom category number ${i} with a long name`,
      seconds: 100,
      audioSeconds: 0,
    }));
    const body = summaryBody(report({ domains, categories }));
    expect(body.length).toBeLessThanOrEqual(1500);
  });
});

describe('summaryMailto', () => {
  test('builds a mailto: URL with an encoded subject and body', () => {
    const url = summaryMailto(report(), 'weekly', 'me@example.com');
    expect(url.startsWith('mailto:me%40example.com?subject=')).toBe(true);
    expect(url).toContain('body=');
    expect(decodeURIComponent(url.split('subject=')[1].split('&body=')[0])).toBe(
      summarySubject(report(), 'weekly'),
    );
  });

  test('an empty recipient still produces a valid (unaddressed) mailto: URL', () => {
    const url = summaryMailto(report(), 'daily', '');
    expect(url.startsWith('mailto:?subject=')).toBe(true);
  });
});
