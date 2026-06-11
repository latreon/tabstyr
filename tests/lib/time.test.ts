import { describe, expect, test } from 'vitest';
import { addDays, dateKey, formatDuration } from '@/lib/time';

describe('formatDuration', () => {
  test('formats sub-minute as <1m', () => {
    expect(formatDuration(20)).toBe('<1m');
  });
  test('formats minutes', () => {
    expect(formatDuration(52 * 60)).toBe('52m');
  });
  test('formats hours and minutes', () => {
    expect(formatDuration(4 * 3600 + 12 * 60)).toBe('4h 12m');
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

test('clamps negative input to <1m', () => {
  expect(formatDuration(-30)).toBe('<1m');
});
test('rounds to nearest minute at the 30-second boundary', () => {
  expect(formatDuration(29)).toBe('<1m');
  expect(formatDuration(30)).toBe('1m');
});
test('suppresses zero minutes on exact hours', () => {
  expect(formatDuration(3600)).toBe('1h');
});
