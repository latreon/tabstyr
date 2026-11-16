declare const chrome: any;

import { browse, dismissOnboarding, expect, test } from './fixtures';

// These tests use tiles inside the collapsible dashboard groups, so start with them open.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('tabstyr:dashboardGroups', JSON.stringify({ trends: true, settings: true })));
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
  await dismissOnboarding(page);
  await expect(page.getByText('Focus today')).toBeVisible();
  await expect(page.getByText('Today by category')).toBeVisible();
  await expect(page.getByText('Activity heatmap')).toBeVisible();
  await expect(page.getByText('Activity trend', { exact: true })).toBeVisible();
  await expect(page.getByText('Focus trend', { exact: true })).toBeVisible();
  await expect(page.getByText('What did I work on?')).toBeVisible();
  await expect(page.getByText('Open tabs by time')).toBeVisible();
  await expect(page.getByText('Settings', { exact: true })).toBeVisible();
});

test('settings export buttons are present', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await dismissOnboarding(page); // onboarding inerts the background until dismissed
  // SettingsPanel sits deep in the dashboard and mounts after data load; give it
  // the same headroom the other post-load assertions use.
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toBeVisible({ timeout: 10_000 });
  // JSON is the only export format now (CSV removed). Restore is the other action.
  await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
});

test('theme toggle flips data-theme', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await dismissOnboarding(page);
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.locator('.theme-toggle').first().click(); // system -> dark
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.locator('.theme-toggle').first().click(); // dark -> light
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  expect(before).toMatch(/dark|light/);
});

test('tracking accumulates time for a browsed tab', async ({ context, extensionId, site }) => {
  await browse(context, site.url('example'));
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await dismissOnboarding(dash); // onboarding inerts the background, hiding the site list
  await expect(dash.getByText('example.test').first()).toBeVisible();
});

test('clicking a tab row focuses that tab', async ({ context, extensionId, site }) => {
  await browse(context, site.url('example'));
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await dismissOnboarding(dash);
  const row = dash.locator('.tab-row', { hasText: 'example.test' }).first();
  await expect(row).toBeVisible();
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
    .toContain('example.test');
});
