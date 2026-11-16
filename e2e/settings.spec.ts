import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { dismissOnboarding, expect, extensionIdOf, launchExtension, openExtensionPage, readSettings, test } from './fixtures';

async function openSettings(context: BrowserContext): Promise<Page> {
  const dashboard = await openExtensionPage(context, await extensionIdOf(context), 'dashboard.html');
  await dismissOnboarding(dashboard);
  const group = dashboard.locator('details.group', { hasText: 'Tabs, categories and settings' });
  if ((await group.getAttribute('open')) === null) await group.locator('summary').click();
  await expect(dashboard.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  return dashboard;
}

const stepper = (page: Page, label: string) => page.getByRole('spinbutton', { name: label, exact: true });
const toggle = (page: Page, label: string) => page.getByRole('switch', { name: label, exact: true });
const picker = (page: Page, label: string) => page.getByRole('button', { name: new RegExp(`^${label}: `) });

async function choose(page: Page, label: string, option: string) {
  await picker(page, label).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function expectChangedValues(page: Page) {
  await expect(stepper(page, 'Stale after (days)')).toHaveValue('4');
  await expect(stepper(page, 'Idle timeout (seconds)')).toHaveValue('195');
  await expect(stepper(page, 'Continuous-session alert (min)')).toHaveValue('35');
  await expect(stepper(page, 'Daily focus goal')).toHaveValue('55');
  await expect(toggle(page, 'Pause tracking')).toHaveAttribute('aria-checked', 'true');
  await expect(toggle(page, 'Count background audio')).toHaveAttribute('aria-checked', 'false');
  await expect(toggle(page, 'Stale-tab reminders')).toHaveAttribute('aria-checked', 'false');
  await expect(picker(page, 'Scheduled backup')).toHaveText('Weekly');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
}

test('every setting survives a page reload and a browser restart', async ({ site }) => {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'tabstyr-e2e-'));
  try {
    let context = await launchExtension({ site, userDataDir });
    let page = await openSettings(context);

    await page.getByRole('button', { name: 'Increase Stale after (days)' }).click();
    await page.getByRole('button', { name: 'Increase Idle timeout (seconds)' }).click();
    await page.getByRole('button', { name: 'Increase Continuous-session alert (min)' }).click();
    await page.getByRole('button', { name: 'Increase Daily focus goal' }).click();
    await toggle(page, 'Pause tracking').click();
    await toggle(page, 'Count background audio').click();
    await toggle(page, 'Stale-tab reminders').click();
    await choose(page, 'Scheduled backup', 'Weekly');
    await choose(page, 'Theme', 'Dark');
    await expect.poll(() => readSettings(context)).toMatchObject({ staleDays: 4, autoExportDays: 7, theme: 'dark', trackingPaused: true });

    await page.reload();
    await expectChangedValues(await openSettings(context));
    await context.close();

    context = await launchExtension({ site, userDataDir });
    page = await openSettings(context);
    await expectChangedValues(page);
    expect(await readSettings(context)).toMatchObject({
      staleDays: 4,
      idleSeconds: 195,
      sessionAlertMinutes: 35,
      focusTarget: 55,
      trackingPaused: true,
      audioEnabled: false,
      notificationsEnabled: false,
      autoExportDays: 7,
      theme: 'dark',
    });
    await context.close();
  } finally {
    rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('a typed number is saved', async ({ context }) => {
  const page = await openSettings(context);
  await stepper(page, 'Stale after (days)').selectText();
  await stepper(page, 'Stale after (days)').pressSequentially('12');
  await stepper(page, 'Stale after (days)').press('Tab');

  await expect(stepper(page, 'Stale after (days)')).toHaveValue('12');
  await expect.poll(async () => (await readSettings(context)).staleDays).toBe(12);
});
