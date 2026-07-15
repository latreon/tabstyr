import { describe, expect, test } from 'vitest';
import { STORE_LIVE, LINKS, ANY_STORE_LIVE, SITE_URL } from '@/site';

// Regression guard for exactly the kind of drift found in the extension's own
// README (a store flipped live in code but a stale placeholder/copy left
// behind elsewhere): once STORE_LIVE[x] is true, LINKS[x] must be a real
// listing URL, not the placeholder homepage a "not yet configured" store uses.
describe('STORE_LIVE / LINKS consistency', () => {
  test('every store flagged live has a non-empty https URL', () => {
    for (const [store, isLive] of Object.entries(STORE_LIVE)) {
      if (!isLive) continue;
      const url = LINKS[store as keyof typeof STORE_LIVE];
      expect(url, `${store} is live but LINKS.${store} is empty`).toBeTruthy();
      expect(url, `${store}'s LINKS entry`).toMatch(/^https:\/\//);
    }
  });

  test('a live Chrome/Firefox listing points at the real store detail page, not a bare homepage', () => {
    if (STORE_LIVE.chrome) expect(LINKS.chrome).toContain('chromewebstore.google.com/detail/');
    if (STORE_LIVE.firefox) expect(LINKS.firefox).toContain('addons.mozilla.org');
  });

  test('ANY_STORE_LIVE matches whether any STORE_LIVE flag is true', () => {
    expect(ANY_STORE_LIVE).toBe(Object.values(STORE_LIVE).some(Boolean));
  });

  test('SITE_URL has no trailing slash (LINKS/SEO helpers assume this)', () => {
    expect(SITE_URL.endsWith('/')).toBe(false);
  });
});
