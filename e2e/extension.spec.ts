declare const chrome: any;

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

test('popup renders gradient total and dashboard button', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('.total')).toBeVisible();
  await expect(page.locator('.cta')).toHaveText('Dashboard');
});

test('dashboard renders bento tiles', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(page.locator('h1')).toContainText('TabTime');
  await expect(page.locator('.hero-tile')).toBeVisible();
  await expect(page.getByText('Open tabs', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Stale tabs', { exact: true }).first()).toBeVisible();
});

test('theme toggle flips data-theme', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.locator('.theme-toggle').first().click(); // system -> dark
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.locator('.theme-toggle').first().click(); // dark -> light
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  expect(before).toMatch(/dark|light/);
});

test('tracking accumulates time for a browsed tab', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForTimeout(2_000);
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(dash.getByText('example.com').first()).toBeVisible({ timeout: 10_000 });
});

test('clicking a tab row focuses that tab', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForTimeout(2_000);
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
  const row = dash.locator('.tab-row', { hasText: 'example.com' }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.click();
  await expect
    .poll(() =>
      dash.evaluate(
        () =>
          new Promise<string | undefined>((res) =>
            chrome.tabs.query({ active: true, lastFocusedWindow: true }, (t: any[]) => res(t[0]?.url)),
          ),
      ),
    )
    .toContain('example.com');
});

test('screenshots for visual review', async ({ context, extensionId }) => {
  for (const theme of ['dark', 'light'] as const) {
    const dash = await context.newPage();
    await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await dash.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    await dash.waitForTimeout(300);
    await dash.screenshot({ path: `e2e/__screenshots__/dashboard-${theme}.png`, fullPage: true });
    const pop = await context.newPage();
    await pop.goto(`chrome-extension://${extensionId}/popup.html`);
    await pop.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    await pop.waitForTimeout(300);
    await pop.screenshot({ path: `e2e/__screenshots__/popup-${theme}.png` });
  }
});
