import { describe, expect, test } from 'vitest';
import { coalesceSessions } from '@/lib/sessionize';

const T0 = new Date(2026, 5, 11, 10, 0).getTime();

describe('coalesceSessions', () => {
  test('stitches consecutive heartbeat rows into one visit', () => {
    // Three back-to-back 1-minute checkpoints = one 3-minute visit.
    const rows = [
      { start: T0, end: T0 + 60_000 },
      { start: T0 + 60_000, end: T0 + 120_000 },
      { start: T0 + 120_000, end: T0 + 180_000 },
    ];
    const visits = coalesceSessions(rows);
    expect(visits).toEqual([{ start: T0, end: T0 + 180_000 }]);
  });

  test('starts a new visit when the gap exceeds the heartbeat window', () => {
    const rows = [
      { start: T0, end: T0 + 60_000 },
      { start: T0 + 10 * 60_000, end: T0 + 11 * 60_000 }, // 9-minute gap → separate visit
    ];
    expect(coalesceSessions(rows)).toHaveLength(2);
  });

  test('sorts unordered input and merges overlaps', () => {
    const rows = [
      { start: T0 + 30_000, end: T0 + 90_000 },
      { start: T0, end: T0 + 60_000 }, // overlaps the first
    ];
    expect(coalesceSessions(rows)).toEqual([{ start: T0, end: T0 + 90_000 }]);
  });

  test('returns empty for no sessions', () => {
    expect(coalesceSessions([])).toEqual([]);
  });
});
