import { describe, expect, test } from 'vitest';
import { topSubPages } from '@/lib/subpages';

const T0 = 1_000_000_000_000;
const s = (url: string, startOffset: number, durMs: number) => ({
  url,
  start: T0 + startOffset,
  end: T0 + startOffset + durMs,
});

describe('topSubPages', () => {
  test('groups sessions by path and ranks by time', () => {
    const { pages } = topSubPages([
      s('https://youtube.com/watch', 0, 120_000),
      s('https://youtube.com/feed', 0, 30_000),
      // > 90s after the first /watch row ends → a distinct second visit
      s('https://youtube.com/watch', 300_000, 60_000),
    ]);
    expect(pages).toEqual([
      { path: '/watch', seconds: 180, visits: 2 },
      { path: '/feed', seconds: 30, visits: 1 },
    ]);
  });

  test('stitches heartbeat rows into a single visit', () => {
    // Two back-to-back ~60s rows on the same path = one real visit.
    const { pages } = topSubPages([
      s('https://a.com/x', 0, 60_000),
      s('https://a.com/x', 60_000, 60_000),
    ]);
    expect(pages[0]).toEqual({ path: '/x', seconds: 120, visits: 1 });
  });

  test('labels the bare root as "/"', () => {
    const { pages } = topSubPages([s('https://a.com/', 0, 10_000), s('https://a.com', 0, 5_000)]);
    expect(pages).toHaveLength(1);
    expect(pages[0].path).toBe('/');
  });

  test('caps at the limit and reports the remainder', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => s(`https://a.com/p${i}`, i * 1000, (i + 1) * 1000));
    const { pages, otherCount } = topSubPages(sessions, 8);
    expect(pages).toHaveLength(8);
    expect(otherCount).toBe(2);
  });

  test('drops zero-duration rows', () => {
    expect(topSubPages([s('https://a.com/x', 0, 0)]).pages).toEqual([]);
  });
});
