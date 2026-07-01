import { describe, expect, test } from 'vitest';
import { parseCsvImport } from '@/lib/import-csv';

describe('parseCsvImport', () => {
  test('parses a RescueTime-style seconds export, aggregating per (date, domain)', () => {
    const csv = [
      'Date,Domain,Time Spent (seconds)',
      '2026-06-10,github.com,3600',
      '2026-06-10,github.com,600', // same day+domain → summed
      '2026-06-11,twitter.com,1200',
    ].join('\n');
    const r = parseCsvImport(csv);
    expect(r.imported).toBe(3);
    expect(r.stats).toContainEqual({ date: '2026-06-10', domain: 'github.com', seconds: 4200, audioSeconds: 0 });
    expect(r.stats).toContainEqual({ date: '2026-06-11', domain: 'twitter.com', seconds: 1200, audioSeconds: 0 });
  });

  test('infers minutes / hours from the duration header', () => {
    expect(parseCsvImport('day,site,minutes\n2026-06-10,a.com,30').stats[0].seconds).toBe(1800);
    expect(parseCsvImport('day,site,hours\n2026-06-10,a.com,2').stats[0].seconds).toBe(7200);
  });

  test('extracts the domain from a full URL and drops non-web activities', () => {
    const r = parseCsvImport(
      ['date,activity,seconds', '2026-06-10,https://github.com/foo,60', '2026-06-10,Microsoft Word,300'].join('\n'),
    );
    expect(r.stats).toEqual([{ date: '2026-06-10', domain: 'github.com', seconds: 60, audioSeconds: 0 }]);
    expect(r.skipped).toBe(1); // "Microsoft Word" → not a web domain
  });

  test('handles quoted fields containing commas', () => {
    const r = parseCsvImport('date,domain,seconds\n2026-06-10,"a,b.com",60');
    // "a,b.com" is not a valid web host → skipped, but the comma must not shift columns
    expect(r.imported + r.skipped).toBe(1);
  });

  test('drops bad dates, zero/negative and non-numeric durations', () => {
    const r = parseCsvImport(
      ['date,domain,seconds', 'not-a-date,a.com,60', '2026-06-10,a.com,0', '2026-06-10,a.com,-5', '2026-06-10,a.com,x'].join('\n'),
    );
    expect(r.imported).toBe(0);
    expect(r.skipped).toBe(4);
  });

  test('accepts MM/DD/YYYY dates and normalizes to YYYY-MM-DD', () => {
    const r = parseCsvImport('Date,Domain,Seconds\n06/10/2026,a.com,60');
    expect(r.stats[0].date).toBe('2026-06-10');
  });

  test('caps a single (date, domain) at the daily ceiling', () => {
    const r = parseCsvImport('date,domain,seconds\n2026-06-10,a.com,999999');
    expect(r.stats[0].seconds).toBe(90_000);
  });

  test('throws on an empty file or missing columns', () => {
    expect(() => parseCsvImport('')).toThrow('empty');
    expect(() => parseCsvImport('just one line')).toThrow('empty');
    expect(() => parseCsvImport('foo,bar\n1,2')).toThrow('columns');
  });
});
