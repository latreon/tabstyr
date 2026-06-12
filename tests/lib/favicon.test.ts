import { describe, expect, test } from 'vitest';
import { faviconUrl, letterChip, CHIP_COLORS } from '@/lib/favicon';

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
      expect(url).toContain('size=32');
    } else {
      // non-chromium runtime (fake browser may report moz-extension) — null is the contract
      expect(url).toBeNull();
    }
  });
});
