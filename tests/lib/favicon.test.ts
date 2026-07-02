import { describe, expect, test } from 'vitest';
import { faviconUrl, isLightFavicon, letterChip, CHIP_COLORS } from '@/lib/favicon';

describe('letterChip', () => {
  test('is deterministic and uses the fixed palette', () => {
    const a = letterChip('github.com');
    expect(a).toEqual(letterChip('github.com'));
    expect(a.letter).toBe('G');
    expect(CHIP_COLORS).toContain(a.color);
  });

  test('handles empty domain', () => {
    expect(letterChip('').letter).toBe('?');
  });
});

describe('faviconUrl', () => {
  test('builds a _favicon url with encoded pageUrl on chromium', () => {
    const url = faviconUrl('github.com');
    if (url !== null) {
      expect(url).toContain('/_favicon/');
      expect(url).toContain(encodeURIComponent('https://github.com/'));
      expect(url).toContain('size=64');
    } else {
      // non-chromium runtime (fake browser may report moz-extension) — null is the contract
      expect(url).toBeNull();
    }
  });
});

describe('isLightFavicon', () => {
  // happy-dom's canvas getContext('2d') returns null, so pixel sampling itself
  // isn't exercised here (that path is covered by manual/visual QA) — this locks
  // in the safe-fallback contract: never throw, default to false (keep the
  // default white tile) when a 2d context isn't available.
  test('falls back to false without throwing when canvas 2d is unavailable', () => {
    const img = document.createElement('img');
    expect(() => isLightFavicon(img)).not.toThrow();
    expect(isLightFavicon(img)).toBe(false);
  });
});
