import { describe, expect, test } from 'vitest';
import { findStale, rematchTabMeta, shouldNotify } from '@/lib/tracker/stale';
import type { TabMeta } from '@/lib/types';

const DAY = 86_400_000;
const NOW = 1_000_000_000_000;

function meta(partial: Partial<TabMeta>): TabMeta {
  return { tabId: 1, key: `k${partial.tabId ?? 1}`, url: 'https://a.com', title: 'A', lastActiveAt: NOW, createdAt: NOW - 10 * DAY, ...partial };
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

  test('tab inactive for exactly the threshold is not flagged', () => {
    const exact = meta({ tabId: 1, lastActiveAt: NOW - 3 * DAY });
    expect(findStale([exact], NOW, 3)).toEqual([]);
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

  test('duplicate metas for the same url keep the most recently active', () => {
    const older = meta({ tabId: 10, url: 'https://a.com', lastActiveAt: NOW - 5 * DAY });
    const newer = meta({ tabId: 11, url: 'https://a.com', lastActiveAt: NOW - DAY });
    // Test both orderings to prove the result is not order-dependent
    const outForward = rematchTabMeta([older, newer], [{ id: 5, url: 'https://a.com' }]);
    expect(outForward).toHaveLength(1);
    expect(outForward[0].lastActiveAt).toBe(NOW - DAY);
    const outReverse = rematchTabMeta([newer, older], [{ id: 5, url: 'https://a.com' }]);
    expect(outReverse).toHaveLength(1);
    expect(outReverse[0].lastActiveAt).toBe(NOW - DAY);
  });

  test('falls back to a same-domain meta when the exact url drifted on restore', () => {
    // Session restore dropped the fragment — exact url no longer matches, but the
    // tab is clearly the same site, so its stable key must survive.
    const m = meta({ tabId: 10, key: 'kKeep', url: 'https://a.com/watch#t=5' });
    const out = rematchTabMeta([m], [{ id: 5, url: 'https://a.com/watch' }]);
    expect(out).toHaveLength(1);
    expect(out[0].tabId).toBe(5);
    expect(out[0].key).toBe('kKeep');
  });

  test('exact-url match wins over domain fallback; no meta is claimed twice', () => {
    const exact = meta({ tabId: 10, key: 'kExact', url: 'https://a.com/x' });
    const other = meta({ tabId: 11, key: 'kOther', url: 'https://a.com/y' });
    const out = rematchTabMeta(
      [exact, other],
      [
        { id: 5, url: 'https://a.com/x' }, // exact → kExact
        { id: 6, url: 'https://a.com/z' }, // no exact → domain fallback → kOther
      ],
    );
    expect(out).toHaveLength(2);
    expect(out.find((m) => m.tabId === 5)?.key).toBe('kExact');
    expect(out.find((m) => m.tabId === 6)?.key).toBe('kOther');
  });

  test('N live tabs sharing a url each claim their own meta (no collapse)', () => {
    const older = meta({ tabId: 10, key: 'kOld', url: 'https://a.com', lastActiveAt: NOW - 5 * DAY });
    const newer = meta({ tabId: 11, key: 'kNew', url: 'https://a.com', lastActiveAt: NOW - DAY });
    const out = rematchTabMeta(
      [older, newer],
      [
        { id: 5, url: 'https://a.com' },
        { id: 6, url: 'https://a.com' },
      ],
    );
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.tabId).sort()).toEqual([5, 6]);
    // distinct metas preserved (keys not collapsed onto one)
    expect(new Set(out.map((m) => m.key))).toEqual(new Set(['kOld', 'kNew']));
    // most-recent meta assigned to the first live tab
    expect(out[0].key).toBe('kNew');
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

  test('suppresses even genuinely new stale ids on the same day (max one per day)', () => {
    expect(shouldNotify([99], [1, 2], '2026-06-11', '2026-06-11')).toBe(false);
  });
});
