// Live end-to-end proof of the webNavigation SPA tracking: drive real pushState
// navigations in one tab and confirm the background records distinct sub-page
// sessions (normalized, query-stripped) for the same domain.
import { browse, dwell, expect, focusedUrl, readSessions, test } from './fixtures';

test('SPA pushState navigations record distinct sub-page sessions', async ({ context, site }) => {
  const page = await browse(context, site.url('example'));

  // In-page navigations (no reload) — the webNavigation listener should split.
  for (const [target, stored] of [
    ['/watch?v=secret-token', '/watch'],
    ['/feed', '/feed'],
    ['/watch?v=other', '/watch'], // same page as /watch
  ]) {
    await page.evaluate((url) => history.pushState({}, '', url), target!);
    await expect.poll(() => focusedUrl(context)).toBe(`http://example.test${stored}`);
    await dwell(context);
  }

  // Closing the tab flushes the open session.
  await page.close();
  await expect.poll(async () => (await readSessions(context)).length).toBeGreaterThanOrEqual(4);
  const urls = (await readSessions(context)).filter((session) => session.domain === 'example.test').map((session) => session.url);

  const paths = new Set(urls.map((url) => new URL(url).pathname));
  // Distinct sub-pages were attributed (not all lumped on "/").
  expect(paths.has('/watch')).toBe(true);
  expect(paths.has('/feed')).toBe(true);
  // Query string with the token was stripped before storage (privacy).
  expect(urls.every((url) => !url.includes('secret-token'))).toBe(true);
  expect(urls.every((url) => !url.includes('?'))).toBe(true);
});
