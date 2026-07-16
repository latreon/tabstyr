import { describe, expect, test } from 'vitest';
import { formatCountdown, remainingMs, startFocusTimer } from '@/lib/focus-timer';

describe('startFocusTimer', () => {
  test('sets endsAt to now + duration', () => {
    const state = startFocusTimer(25, 1_000_000);
    expect(state.endsAt).toBe(1_000_000 + 25 * 60_000);
    expect(state.durationMin).toBe(25);
  });
});

describe('remainingMs', () => {
  test('null state has no remaining time', () => {
    expect(remainingMs(null, 1_000_000)).toBe(0);
  });

  test('counts down toward endsAt', () => {
    const state = startFocusTimer(25, 0);
    expect(remainingMs(state, 60_000)).toBe(25 * 60_000 - 60_000);
  });

  test('clamps at 0 once past endsAt (never negative)', () => {
    const state = startFocusTimer(25, 0);
    expect(remainingMs(state, 999_999_999)).toBe(0);
  });
});

describe('formatCountdown', () => {
  test('formats minutes and seconds as MM:SS', () => {
    expect(formatCountdown(25 * 60_000)).toBe('25:00');
    expect(formatCountdown(65_000)).toBe('01:05');
    expect(formatCountdown(9_000)).toBe('00:09');
  });

  test('rounds up so it never shows 00:00 while time remains', () => {
    expect(formatCountdown(400)).toBe('00:01');
  });

  test('zero remaining formats as 00:00', () => {
    expect(formatCountdown(0)).toBe('00:00');
  });
});
