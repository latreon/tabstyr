import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, openExtensionPage, seedHistory, test, todayKey, writeSettings } from './fixtures';

const history = {
  dailyStats: [
    { date: todayKey(), domain: 'github.test', seconds: 5_400, audioSeconds: 0 },
    { date: todayKey(), domain: 'mail.test', seconds: 2_700, audioSeconds: 0 },
  ],
};

/** Serious and critical axe violations, as short readable lines. */
async function seriousViolations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')}`));
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ context }) => {
      await writeSettings(context, { theme, onboarded: true });
      await seedHistory(context, history);
      await context.addInitScript(() => localStorage.setItem('tabstyr:dashboardGroups', JSON.stringify({ trends: true, settings: true })));
    });

    test('popup', async ({ context, extensionId }) => {
      const popup = await openExtensionPage(context, extensionId, 'popup.html');
      await expect(popup.getByText('mail.test')).toBeVisible();
      await expect(popup.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await seriousViolations(popup)).toEqual([]);
    });

    test('dashboard', async ({ context, extensionId }) => {
      const dashboard = await openExtensionPage(context, extensionId, 'dashboard.html');
      await expect(dashboard.getByText('mail.test').first()).toBeVisible();
      await expect(dashboard.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await seriousViolations(dashboard)).toEqual([]);
    });

    test('dashboard dialogs', async ({ context, extensionId }) => {
      const dashboard = await openExtensionPage(context, extensionId, 'dashboard.html');
      await expect(dashboard.getByText('mail.test').first()).toBeVisible();

      await dashboard.getByRole('button', { name: 'Wipe all data' }).click();
      await expect(dashboard.getByRole('dialog')).toBeVisible();
      expect.soft(await seriousViolations(dashboard), 'wipe dialog').toEqual([]);
      await dashboard.keyboard.press('Escape');

      await dashboard.getByText('mail.test').first().click();
      await expect(dashboard.getByRole('dialog')).toBeVisible();
      expect.soft(await seriousViolations(dashboard), 'site detail').toEqual([]);
      await dashboard.keyboard.press('Escape');

      const privacy = await context.newPage();
      await privacy.goto(`chrome-extension://${extensionId}/dashboard.html#privacy`);
      await expect(privacy.getByRole('dialog')).toBeVisible();
      expect.soft(await seriousViolations(privacy), 'privacy dialog').toEqual([]);
    });
  });
}

test('first-run intro', async ({ context, extensionId }) => {
  const dashboard = await openExtensionPage(context, extensionId, 'dashboard.html');
  await expect(dashboard.getByRole('dialog', { name: 'Welcome to TabStyr' })).toBeVisible();
  expect(await seriousViolations(dashboard)).toEqual([]);
});
