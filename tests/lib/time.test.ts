import { describe, expect, test } from 'vitest';
import { addDays, dateKey, dayLabel, formatDuration, monthLabel } from '@/lib/time';

describe('formatDuration', () => {
  test('formats sub-minute as exact seconds', () => {
    expect(formatDuration(20)).toBe('20s');
  });
  test('formats minutes + exact seconds under an hour', () => {
    expect(formatDuration(5 * 60 + 23)).toBe('5m 23s');
  });
  test('omits seconds when a whole number of minutes', () => {
    expect(formatDuration(52 * 60)).toBe('52m');
  });
  test('formats hours and minutes (seconds dropped at/over 1h)', () => {
    expect(formatDuration(4 * 3600 + 12 * 60)).toBe('4h 12m');
    expect(formatDuration(3600 + 23)).toBe('1h'); // 1h 0m 23s → seconds omitted
  });
  test('the m/s split exactly reconstructs the input', () => {
    for (const s of [0, 1, 59, 60, 61, 599, 3599]) {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      const expected = m === 0 ? `${sec}s` : sec === 0 ? `${m}m` : `${m}m ${sec}s`;
      expect(formatDuration(s)).toBe(expected);
    }
  });
});

describe('dateKey', () => {
  test('formats local date as YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 5, 11, 14, 30).getTime())).toBe('2026-06-11');
  });
});

describe('addDays', () => {
  test('adds and subtracts days across month boundaries', () => {
    expect(addDays('2026-06-11', -90)).toBe('2026-03-13');
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
  });
});

test('zero and negative input render as 0s', () => {
  expect(formatDuration(0)).toBe('0s');
  expect(formatDuration(-30)).toBe('0s');
});
test('shows exact seconds, not rounded to a minute', () => {
  expect(formatDuration(29)).toBe('29s');
  expect(formatDuration(30)).toBe('30s');
  expect(formatDuration(90)).toBe('1m 30s');
});
test('rounds fractional seconds to the nearest whole second', () => {
  expect(formatDuration(45.4)).toBe('45s');
  expect(formatDuration(45.6)).toBe('46s');
});
test('suppresses zero minutes on exact hours', () => {
  expect(formatDuration(3600)).toBe('1h');
});
test('rolls large hour totals into days', () => {
  expect(formatDuration(24 * 3600)).toBe('1d'); // exactly one day
  expect(formatDuration(27 * 3600)).toBe('1d 3h'); // 1 day 3 hours
  expect(formatDuration(50 * 3600)).toBe('2d 2h');
});

describe('dayLabel', () => {
  test('formats a YYYY-MM-DD key as "Mon D"', () => {
    expect(dayLabel('2026-06-11')).toBe('Jun 11');
    expect(dayLabel('2026-01-05')).toBe('Jan 5');
  });
});

describe('monthLabel', () => {
  test('formats a YYYY-MM key as the short month name', () => {
    expect(monthLabel('2026-06')).toBe('Jun');
    expect(monthLabel('2026-12')).toBe('Dec');
  });
});
