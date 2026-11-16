import { browse, dwell, expect, focusTab, focusedUrl, readSessions, test, writeSettings } from './fixtures';
import type { BrowserContext } from '@playwright/test';

// Pages the tracker has stored a session for, once their tabs are closed.
async function storedPages(context: BrowserContext): Promise<string[]> {
  return [...new Set((await readSessions(context)).map((session) => session.url))];
}

test('time on a static page is saved when its tab closes', async ({ context, site }) => {
  const tab = await browse(context, site.url('news'));
  await tab.close();

  await expect.poll(() => storedPages(context)).toEqual(['http://news.test/']);
  const [session] = await readSessions(context);
  expect(session!.domain).toBe('news.test');
  expect(session!.end).toBeGreaterThan(session!.start);
});

test('switching tabs splits the time between the two sites', async ({ context, site }) => {
  const first = await browse(context, site.url('news'));
  await browse(context, site.url('mail'));
  await focusTab(context, first);
  await expect.poll(() => focusedUrl(context)).toBe('http://news.test/');

  await expect.poll(() => storedPages(context)).toEqual(expect.arrayContaining(['http://news.test/', 'http://mail.test/']));
});

test('SPA route changes are tracked as separate pages, including Back', async ({ context, site }) => {
  const tab = await browse(context, site.url('app', '/spa'));

  await tab.getByRole('link', { name: 'One' }).click();
  await expect.poll(() => focusedUrl(context)).toBe('http://app.test/spa/one');
  await dwell(context);
  await tab.getByRole('link', { name: 'Two' }).click();
  await expect.poll(() => focusedUrl(context)).toBe('http://app.test/spa/two');
  await dwell(context);
  await tab.goBack();
  await expect.poll(() => focusedUrl(context)).toBe('http://app.test/spa/one');
  await dwell(context);

  await tab.close();
  await expect.poll(() => storedPages(context)).toEqual(
    expect.arrayContaining(['http://app.test/spa', 'http://app.test/spa/one', 'http://app.test/spa/two']),
  );
});

test('a route change inside an iframe does not move the time', async ({ context, site }) => {
  const tab = await browse(context, site.url('host', '/frame'));

  await tab.frameLocator('iframe').getByRole('link', { name: 'One' }).click();
  await expect(tab.frameLocator('iframe').locator('body')).toBeVisible();
  await tab.close();

  await expect.poll(() => storedPages(context)).toEqual(['http://host.test/frame']);
});

test('a slow page is tracked once it loads', async ({ context, site }) => {
  await browse(context, site.url('slow', '/slow'));
});

test('a page with a strict CSP is tracked like any other', async ({ context, site }) => {
  await browse(context, site.url('locked', '/csp'));
});

test('an excluded site is never tracked', async ({ context, site }) => {
  await writeSettings(context, { excludedDomains: ['secret.test'] });
  const tab = await context.newPage();
  await tab.goto(site.url('secret'));
  await focusTab(context, tab);
  const other = await browse(context, site.url('news'));
  await other.close();
  await tab.close();

  await expect.poll(() => storedPages(context)).toEqual(['http://news.test/']);
});

test('nothing is tracked while tracking is paused', async ({ context, site }) => {
  await writeSettings(context, { trackingPaused: true });
  const tab = await context.newPage();
  await tab.goto(site.url('news'));
  await focusTab(context, tab);

  await expect.poll(() => focusedUrl(context), { timeout: 2_000 }).toBeNull();
});
