import type { BrowserContext } from '@playwright/test';
import { browse, expect, focusTab, focusedUrl, openExtensionPage, readSessions, serviceWorker, test } from './fixtures';

// Blocked: stopping the extension's worker (CDP stopWorker/stopAllWorkers or the Stop
// button in chrome://serviceworker-internals) closes Playwright's persistent context
// with it. Worker restart is covered in tests/entrypoints/background.test.ts until
// that works.
test.fixme();

/** Stop the extension's service worker, the way Chrome does when it goes idle. */
async function stopServiceWorker(context: BrowserContext) {
  const worker = await serviceWorker(context);
  const internals = await context.newPage();
  await internals.goto('chrome://serviceworker-internals/');
  const closed = new Promise((resolve) => worker.once('close', resolve));
  await internals.getByRole('button', { name: 'Stop', exact: true }).click();
  await closed;
  await internals.close();
}

test('an open session survives the service worker being stopped', async ({ context, site }) => {
  const news = await browse(context, site.url('news'));
  const focusedAt = Date.now();

  await stopServiceWorker(context);
  expect(context.serviceWorkers()).toHaveLength(0);

  // Any browser event starts the worker again.
  const mail = await context.newPage();
  await mail.goto(site.url('mail'));
  await focusTab(context, mail);
  await expect.poll(() => focusedUrl(context)).toBe('http://mail.test/');
  const switchedAt = Date.now();

  await expect.poll(async () => (await readSessions(context)).some((session) => session.domain === 'news.test')).toBe(true);
  const newsSession = (await readSessions(context)).find((session) => session.domain === 'news.test')!;
  // The session kept its original start, so the time while the worker was down counts.
  expect(newsSession.end - newsSession.start).toBeGreaterThanOrEqual(switchedAt - focusedAt - 1_000);
  await news.close();
});

test('the dashboard still loads after the worker was stopped', async ({ context, extensionId }) => {
  await stopServiceWorker(context);
  const dashboard = await openExtensionPage(context, extensionId, 'dashboard.html');
  await expect(dashboard.locator('.hero-tile')).toBeVisible();
});
