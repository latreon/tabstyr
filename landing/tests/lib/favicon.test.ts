import { describe, expect, test } from 'vitest';
import { faviconUrl, faviconSources, resolvedFavicon, preloadFavicon, preloadFavicons } from '@/lib/favicon';

// These are all deliberate no-ops (see the file's own header comment): a prior
// version fetched real favicons from third parties, which leaked the user's
// top-site hostnames and contradicted the "0 bytes leave your device" promise.
// This test exists to catch a regression back to a real network call.
describe('favicon (privacy no-op stubs)', () => {
  test('faviconUrl never returns a remote URL', () => {
    expect(faviconUrl('github.com')).toBeNull();
    expect(faviconUrl('')).toBeNull();
  });

  test('faviconSources is always empty', () => {
    expect(faviconSources('github.com')).toEqual([]);
  });

  test('resolvedFavicon never resolves to a URL', () => {
    expect(resolvedFavicon('github.com')).toBeNull();
  });

  test('preloadFavicon(s) are no-ops that return nothing', () => {
    expect(preloadFavicon('github.com')).toBeUndefined();
    expect(preloadFavicons(['github.com', 'youtube.com'])).toBeUndefined();
  });
});
