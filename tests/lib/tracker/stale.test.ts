import { describe, expect, test } from 'vitest';
import { findStale, rematchTabMeta, shouldNotify } from '@/lib/tracker/stale';
import type { TabMeta } from '@/lib/types';

const DAY = 86_400_000;
const NOW = 1_000_000_000_000;

function meta(partial: Partial<TabMeta>): TabMeta {
  return { tabId: 1, url: 'https://a.com', title: 'A', lastActiveAt: NOW, createdAt: NOW - 10 * DAY, ...partial };
}

describe('findStale', () => {
  test('returns tabs inactive beyond threshold', () => {
    const metas = [
      meta({ tabId: 1, lastActiveAt: NOW - 4 * DAY }),
      meta({ tabId: 2, lastActiveAt: NOW - DAY }),
    ];
    expect(findStale(metas, NOW, 3).map((m) => m.tabId)).toEqual([1]);
  });

  test('excludes snoozed tabs until snooze expires', () => {
    const snoozed = meta({ tabId: 1, lastActiveAt: NOW - 5 * DAY, snoozedUntil: NOW + DAY });
    const expired = meta({ tabId: 2, lastActiveAt: NOW - 5 * DAY, snoozedUntil: NOW - 1 });
    expect(findStale([snoozed, expired], NOW, 3).map((m) => m.tabId)).toEqual([2]);
  });
});

describe('rematchTabMeta', () => {
  test('reassigns tabIds by url match and drops unmatched', () => {
    const metas = [meta({ tabId: 10, url: 'https://a.com' }), meta({ tabId: 11, url: 'https://gone.com' })];
    const out = rematchTabMeta(metas, [{ id: 5, url: 'https://a.com' }]);
    expect(out).toHaveLength(1);
    expect(out[0].tabId).toBe(5);
    expect(out[0].url).toBe('https://a.com');
  });

  test('duplicate urls match at most once', () => {
    const metas = [meta({ tabId: 10, url: 'https://a.com' })];
    const out = rematchTabMeta(metas, [
      { id: 5, url: 'https://a.com' },
      { id: 6, url: 'https://a.com' },
    ]);
    expect(out).toHaveLength(1);
  });
});

describe('shouldNotify', () => {
  test('notifies when new stale ids exist and not yet notified today', () => {
    expect(shouldNotify([1, 2], [1], '2026-06-10', '2026-06-11')).toBe(true);
  });
  test('does not notify twice on the same day', () => {
    expect(shouldNotify([1, 2], [], '2026-06-11', '2026-06-11')).toBe(false);
  });
  test('does not notify when all stale ids were already notified', () => {
    expect(shouldNotify([1, 2], [1, 2], '2026-06-10', '2026-06-11')).toBe(false);
  });
  test('does not notify when nothing is stale', () => {
    expect(shouldNotify([], [], '2026-06-10', '2026-06-11')).toBe(false);
  });
});
