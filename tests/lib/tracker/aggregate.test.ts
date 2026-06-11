import { describe, expect, test } from 'vitest';
import { rollup } from '@/lib/tracker/aggregate';
import { dateKey } from '@/lib/time';
import type { Session } from '@/lib/types';

const T0 = new Date(2026, 5, 11, 10, 0).getTime();
const DATE = dateKey(T0);

function session(partial: Partial<Session>): Session {
  return { tabId: 1, url: 'https://a.com/x', domain: 'a.com', start: T0, end: T0 + 60_000, audio: false, ...partial };
}

describe('rollup', () => {
  test('sums seconds per date+domain', () => {
    const out = rollup([
      session({}),
      session({ start: T0 + 120_000, end: T0 + 180_000 }),
      session({ domain: 'b.com', end: T0 + 30_000 }),
    ]);
    expect(out).toContainEqual({ date: DATE, domain: 'a.com', seconds: 120, audioSeconds: 0 });
    expect(out).toContainEqual({ date: DATE, domain: 'b.com', seconds: 30, audioSeconds: 0 });
  });

  test('counts audio sessions in both seconds and audioSeconds', () => {
    const out = rollup([session({ audio: true })]);
    expect(out).toEqual([{ date: DATE, domain: 'a.com', seconds: 60, audioSeconds: 60 }]);
  });

  test('returns empty for no sessions', () => {
    expect(rollup([])).toEqual([]);
  });
});
