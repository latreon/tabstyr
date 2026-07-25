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

// Column detection used plain `includes` with no mutual exclusion, so 'day' matched a
// "Monday" column and a single "DateTime" column satisfied BOTH the date and the
// duration role — every row was then parsed with a date as its duration and silently
// skipped, with no error to explain why the import produced nothing.
describe('parseCsvImport column detection', () => {
  test('a weekday column does not get mistaken for the date column', () => {
    const csv = [
      'Monday,Date,Domain,Seconds',
      'yes,2026-06-11,github.com,120',
    ].join('\n');
    const out = parseCsvImport(csv);
    expect(out.stats).toEqual([{ date: '2026-06-11', domain: 'github.com', seconds: 120, audioSeconds: 0 }]);
  });

  test('one ambiguous column cannot fill two roles — it errors instead of skipping every row', () => {
    // "DateTime" contains both 'date' and 'time'; claiming makes the missing role explicit.
    expect(() => parseCsvImport('DateTime,Domain\n2026-06-11,github.com')).toThrow('columns');
  });

  test('an exact header name wins over a substring match', () => {
    const csv = [
      'Time spent (minutes),Date,Domain,Duration',
      '5,2026-06-11,github.com,999',
    ].join('\n');
    // 'duration' is tried before the looser 'time', and it is an exact header, so the
    // Duration column is the one claimed — unit falls back to seconds.
    expect(parseCsvImport(csv).stats[0].seconds).toBe(999);
  });

  test('still infers the unit from the claimed duration column header', () => {
    const hours = parseCsvImport('Date,Domain,Hours\n2026-06-11,github.com,2');
    expect(hours.stats[0].seconds).toBe(7200);
    const minutes = parseCsvImport('Date,Domain,Minutes\n2026-06-11,github.com,2');
    expect(minutes.stats[0].seconds).toBe(120);
  });
});
