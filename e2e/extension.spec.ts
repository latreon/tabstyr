declare const chrome: any;

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

test('popup renders gradient total and dashboard button', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('.total')).toBeVisible();
  await expect(page.locator('.cta')).toHaveText('Dashboard');
});

test('dashboard renders bento tiles', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(page.locator('h1')).toContainText('TabStyr');
  await expect(page.locator('.hero-tile')).toBeVisible();
  await expect(page.getByText('Open tabs', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Stale tabs', { exact: true }).first()).toBeVisible();
});

test('dashboard renders all analytics tiles', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(page.getByText('Focus today')).toBeVisible();
  await expect(page.getByText('Today by category')).toBeVisible();
  await expect(page.getByText('Activity heatmap')).toBeVisible();
  await expect(page.getByText('Trend')).toBeVisible();
  await expect(page.getByText('What did I work on?')).toBeVisible();
  await expect(page.getByText('Open tabs by time')).toBeVisible();
  await expect(page.getByText('Settings')).toBeVisible();
});

test('settings export buttons are present', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(page.getByRole('button', { name: 'JSON backup' })).toBeVisible();
  await expect(page.getByRole('button', { name: /CSV/ }).first()).toBeVisible();
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
    // ── Dashboard ──────────────────────────────────────────────────────────
    const dash = await context.newPage();
    await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
    // Wait for the Vue app to mount and useTheme's async getSettings().then(apply)
    // to settle BEFORE forcing the theme, otherwise onMounted overwrites it back.
    await dash.waitForSelector('.bento, .label', { state: 'visible' });
    await dash.waitForTimeout(400);
    await dash.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    // Poll until the attribute is actually set (guards against any residual async flush).
    await expect
      .poll(() => dash.evaluate(() => document.documentElement.dataset.theme))
      .toBe(theme);
    await dash.waitForTimeout(200);
    await dash.screenshot({ path: `e2e/__screenshots__/dashboard-${theme}.png`, fullPage: true });

    // ── Popup ──────────────────────────────────────────────────────────────
    const pop = await context.newPage();
    // Set the popup viewport to realistic extension dimensions before navigating.
    await pop.setViewportSize({ width: 360, height: 620 });
    await pop.goto(`chrome-extension://${extensionId}/popup.html`);
    await pop.waitForSelector('.total, .cta', { state: 'visible' });
    await pop.waitForTimeout(400);
    await pop.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    await expect
      .poll(() => pop.evaluate(() => document.documentElement.dataset.theme))
      .toBe(theme);
    await pop.waitForTimeout(200);
    await pop.screenshot({ path: `e2e/__screenshots__/popup-${theme}.png` });
  }
});
