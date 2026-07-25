import { describe, expect, test } from 'vitest';
import { monthOf, monthKeyBefore } from '@/lib/monthly';

// Rolling daily rows into the archive is tested through repo.pruneBefore (its only
// production path) in tests/lib/db/repo.test.ts.

describe('monthOf', () => {
  test('takes the YYYY-MM prefix of a date key', () => {
    expect(monthOf('2026-03-14')).toBe('2026-03');
  });
});

describe('monthKeyBefore', () => {
  // monthKeyBefore reads local getters (getFullYear/getMonth), so build inputs
  // with the local-time constructor too — a UTC timestamp could land on a
  // different local calendar day/month depending on the runner's timezone.
  test('subtracts whole calendar months', () => {
    expect(monthKeyBefore(new Date(2026, 5, 15).getTime(), 1)).toBe('2026-05'); // June -> May
    expect(monthKeyBefore(new Date(2026, 5, 15).getTime(), 12)).toBe('2025-06');
    expect(monthKeyBefore(new Date(2026, 5, 15).getTime(), 60)).toBe('2021-06');
  });

  test('does not roll over across a short month (pinned to the 1st first)', () => {
    // Mar 31 minus 1 month must land in February, not roll into March again.
    expect(monthKeyBefore(new Date(2026, 2, 31).getTime(), 1)).toBe('2026-02');
  });

  test('crosses a year boundary', () => {
    expect(monthKeyBefore(new Date(2026, 1, 10).getTime(), 3)).toBe('2025-11');
  });

  test('0 months returns the current month', () => {
    expect(monthKeyBefore(new Date(2026, 5, 15).getTime(), 0)).toBe('2026-06');
  });
});
