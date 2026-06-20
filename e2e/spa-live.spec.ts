/* eslint-disable */
declare const chrome: any;

// Live end-to-end proof of the webNavigation SPA tracking: drive real pushState
// navigations in one tab and confirm the background records distinct sub-page
// sessions (normalized, query-stripped) for the same domain.
import { test as base, chromium, expect, type BrowserContext } from '@playwright/test';
import path from 'node:path';

const EXT_PATH = path.resolve('dist/chrome-mv3');

const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(worker.url().split('/')[2]);
  },
});

test('SPA pushState navigations record distinct sub-page sessions', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto('https://example.com/');
  await page.waitForTimeout(1500); // accrue time on "/"

  // In-page navigations (no reload) — the webNavigation listener should split.
  await page.evaluate(() => history.pushState({}, '', '/watch?v=secret-token'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => history.pushState({}, '', '/feed'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => history.pushState({}, '', '/watch?v=other')); // same page as /watch
  await page.waitForTimeout(1500);

  // Flush the open session, then read the raw sessions from the extension's DB.
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await dash.waitForSelector('.bento, .label', { state: 'visible' });
  await dash.waitForTimeout(1200);

  const urls: string[] = await dash.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('tab-time');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows: any[] = await new Promise((res, rej) => {
      const tx = db.transaction('sessions', 'readonly');
      const req = tx.objectStore('sessions').getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return rows.filter((r) => r.domain === 'example.com').map((r) => r.url);
  });

  const paths = new Set(urls.map((u) => new URL(u).pathname));
  // Distinct sub-pages were attributed (not all lumped on "/").
  expect(paths.has('/watch')).toBe(true);
  expect(paths.has('/feed')).toBe(true);
  // Query string with the token was stripped before storage (privacy).
  expect(urls.every((u) => !u.includes('secret-token'))).toBe(true);
  expect(urls.every((u) => !u.includes('?'))).toBe(true);
});
