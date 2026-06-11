import { test as base, chromium, expect, type BrowserContext } from '@playwright/test';
import path from 'node:path';

const EXT_PATH = path.resolve('.output/chrome-mv3');

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

test('popup renders today total and dashboard button', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('.hero .label')).toHaveText('Today');
  await expect(page.locator('.cta')).toHaveText('Open dashboard');
});

test('dashboard renders bento tiles', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(page.locator('h1')).toHaveText('Tab Time');
  await expect(page.locator('.hero-tile')).toBeVisible();
  await expect(page.getByText('Open tabs', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Stale tabs', { exact: true }).first()).toBeVisible();
});

test('tracking accumulates time for a browsed tab', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForTimeout(2_000); // accrue a session
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(dash.getByText('example.com').first()).toBeVisible({ timeout: 10_000 });
});
