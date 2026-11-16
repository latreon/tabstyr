declare const chrome: any;

import { dismissOnboarding, expect, inWorker, readSettings, test } from './fixtures';

test('a fresh install opens the dashboard with the intro', async ({ context, extensionId }) => {
  const dashboard = context.pages().find((tab) => tab.url().endsWith('/dashboard.html')) ?? (await context.waitForEvent('page'));
  await expect(dashboard).toHaveURL(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(dashboard.getByRole('dialog', { name: 'Welcome to TabStyr' })).toBeVisible();
});

test('first-run settings are the defaults, and the panel shows them', async ({ context }) => {
  const dashboard = context.pages().find((tab) => tab.url().endsWith('/dashboard.html')) ?? (await context.waitForEvent('page'));
  await dismissOnboarding(dashboard);

  expect(await readSettings(context)).toMatchObject({
    staleDays: 3,
    idleSeconds: 180,
    audioEnabled: true,
    notificationsEnabled: true,
    sessionAlertMinutes: 30,
    focusTarget: 50,
    language: 'auto',
    theme: 'system',
    trackingPaused: false,
    autoExportDays: 0,
    onboarded: true,
  });
  await dashboard.locator('details.group').nth(1).locator('summary').click();
  await expect(dashboard.getByRole('spinbutton', { name: 'Stale after (days)' })).toHaveValue('3');
});

test('the manifest asks only for the expected permissions and no host access', async ({ context }) => {
  const manifest = await inWorker(context, () => chrome.runtime.getManifest());
  expect([...manifest.permissions].sort()).toEqual(
    ['alarms', 'downloads', 'favicon', 'idle', 'notifications', 'storage', 'tabs', 'unlimitedStorage', 'webNavigation'].sort(),
  );
  expect(manifest.host_permissions ?? []).toEqual([]);
  expect(manifest.content_scripts ?? []).toEqual([]);
  expect(manifest.optional_permissions ?? []).toEqual([]);
});

test('the install date is recorded once', async ({ context }) => {
  await expect.poll(() => inWorker(context, async () => (await chrome.storage.local.get('installedAt')).installedAt)).toEqual(expect.any(Number));
});
