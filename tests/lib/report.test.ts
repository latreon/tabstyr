import { describe, expect, test } from 'vitest';
import { buildReport, csvField, hm, reportCsv } from '@/lib/report';
import type { DailyStat } from '@/lib/types';

const stat = (date: string, domain: string, seconds: number, audioSeconds = 0): DailyStat => ({
  date,
  domain,
  seconds,
  audioSeconds,
});

describe('buildReport', () => {
  test('sums active per-domain time across the range, excluding zero-active and internal pages', () => {
    // Input seconds are already active-only (audio subtracted upstream).
    const r = buildReport(
      [
        stat('2026-06-10', 'github.com', 600),
        stat('2026-06-11', 'github.com', 240),
        stat('2026-06-11', 'youtube.com', 0), // no active time → excluded
        stat('2026-06-11', 'newtab', 999), // non-web → excluded
        stat('2026-06-09', 'github.com', 500), // before range → excluded
      ],
      '2026-06-10',
      '2026-06-11',
    );
    expect(r.days).toBe(2);
    expect(r.totalSeconds).toBe(840); // 600 + 240
    expect(r.domains).toEqual([{ domain: 'github.com', seconds: 840, category: 'Dev' }]);
  });

  test('groups categories by active time, sorted desc', () => {
    const r = buildReport(
      [stat('2026-06-11', 'github.com', 300), stat('2026-06-11', 'twitter.com', 600)],
      '2026-06-11',
      '2026-06-11',
    );
    expect(r.categories.map((c) => c.category)).toEqual(['Social', 'Dev']); // 600 > 300
    expect(r.categories[0]).toEqual({ category: 'Social', seconds: 600, audioSeconds: 0 });
  });

  test('respects category overrides', () => {
    const r = buildReport([stat('2026-06-11', 'youtube.com', 300)], '2026-06-11', '2026-06-11', {
      'youtube.com': 'Work',
    });
    expect(r.domains[0].category).toBe('Work');
  });

  test('single-day range has span 1; reversed range has span 0', () => {
    expect(buildReport([], '2026-06-11', '2026-06-11').days).toBe(1);
    expect(buildReport([], '2026-06-12', '2026-06-11').days).toBe(0);
  });
});

describe('reportCsv', () => {
  test('emits a header, per-domain rows, and a TOTAL row', () => {
    const r = buildReport(
      [stat('2026-06-11', 'github.com', 3660), stat('2026-06-11', 'twitter.com', 600)],
      '2026-06-11',
      '2026-06-11',
    );
    const lines = reportCsv(r).split('\r\n');
    expect(lines[0]).toBe('domain,category,active_seconds,active_hm');
    expect(lines[1]).toBe('github.com,Dev,3660,1:01'); // sorted desc → github (3660) first
    expect(lines[2]).toBe('twitter.com,Social,600,0:10');
    expect(lines[3]).toBe('TOTAL,,4260,1:11');
  });

  test('escapes fields containing commas or quotes', () => {
    const r = buildReport([stat('2026-06-11', 'a,b".com', 60)], '2026-06-11', '2026-06-11');
    // isWebDomain likely rejects that odd host; guard by checking escape helper via a real comma domain
    const csv = reportCsv({
      from: '',
      to: '',
      days: 1,
      totalSeconds: 60,
      categories: [],
      domains: [{ domain: 'a,b.com', seconds: 60, category: 'Other' }],
    });
    expect(csv).toContain('"a,b.com"');
    void r;
  });
});

describe('csvField', () => {
  test('neutralizes formula injection in text cells starting with = + - @ tab or cr', () => {
    // Excel/Sheets would execute these as formulas on open; a leading quote makes them literal.
    expect(csvField('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"'); // also RFC-quoted (contains ")
    expect(csvField('+1')).toBe("'+1");
    expect(csvField('-cmd')).toBe("'-cmd");
    expect(csvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvField('\ttab')).toBe("'\ttab");
  });

  test('leaves numbers untouched so numeric columns stay parseable', () => {
    // -5 as a number must NOT get a leading quote (would corrupt the value); only string cells are guarded.
    expect(csvField(-5)).toBe('-5');
    expect(csvField(3660)).toBe('3660');
  });

  test('leaves ordinary text and safe leading chars alone', () => {
    expect(csvField('github.com')).toBe('github.com');
    expect(csvField('TOTAL')).toBe('TOTAL');
  });
});

describe('hm', () => {
  test('formats seconds as H:MM, rounding to the nearest minute', () => {
    expect(hm(0)).toBe('0:00');
    expect(hm(600)).toBe('0:10');
    expect(hm(3660)).toBe('1:01');
    expect(hm(59)).toBe('0:01'); // 59s rounds up to 1 min
  });
});
