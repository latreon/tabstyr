import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, openExtensionPage, seedHistory, test, todayKey, writeSettings } from './fixtures';

const LOCALES = ['en', 'es', 'de', 'fr', 'it', 'pt-BR', 'ru', 'tr', 'ja', 'ko', 'zh-CN'] as const;

// Every message key, e.g. "settings.staleDays". A key shown as text means a missing translation.
type Tree = { [key: string]: string | Tree };
function keysOf(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => (typeof value === 'string' ? [prefix + key] : keysOf(value, `${prefix}${key}.`)));
}
const KEYS = keysOf(JSON.parse(readFileSync('lib/i18n/locales/en.json', 'utf8')));

const history = {
  dailyStats: [
    { date: todayKey(), domain: 'a-very-long-subdomain-name.example-company.test', seconds: 5_400, audioSeconds: 0 },
    { date: todayKey(), domain: 'mail.test', seconds: 2_700, audioSeconds: 600 },
    { date: todayKey(), domain: 'news.test', seconds: 1_200, audioSeconds: 0 },
  ],
};

/** How far the page is wider than the viewport: a translation pushed the layout out. */
const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function expectFullyTranslated(page: Page, warnings: string[]) {
  const text = await page.locator('body').innerText();
  expect(KEYS.filter((key) => text.includes(key)), 'message keys shown as text').toEqual([]);
  expect(warnings, 'vue-i18n warnings').toEqual([]);
}

for (const locale of LOCALES) {
  test(`${locale}: dashboard and popup are translated and fit at every width`, async ({ context, extensionId }) => {
    const warnings: string[] = [];
    context.on('console', (message) => {
      if (/intlify|vue-i18n|Not found/i.test(message.text())) warnings.push(message.text());
    });
    await writeSettings(context, { language: locale, onboarded: true });
    await seedHistory(context, history);
    await context.addInitScript(() => localStorage.setItem('tabstyr:dashboardGroups', JSON.stringify({ trends: true, settings: true })));

    for (const width of [1440, 768, 380]) {
      const dashboard = await openExtensionPage(context, extensionId, 'dashboard.html');
      await dashboard.setViewportSize({ width, height: 1000 });
      await expect(dashboard.locator('html')).toHaveAttribute('lang', locale);
      await expect(dashboard.locator('.hero-tile')).toBeVisible();
      await expect(dashboard.getByText('mail.test').first()).toBeVisible();

      expect(await horizontalOverflow(dashboard), `dashboard is wider than ${width}px`).toBeLessThanOrEqual(1);
      await expectFullyTranslated(dashboard, warnings);
      await dashboard.close();
    }

    const popup = await openExtensionPage(context, extensionId, 'popup.html');
    await popup.setViewportSize({ width: 360, height: 620 });
    await expect(popup.locator('html')).toHaveAttribute('lang', locale);
    await expect(popup.getByText('mail.test')).toBeVisible();
    expect(await horizontalOverflow(popup), 'popup is wider than 360px').toBeLessThanOrEqual(1);
    await expectFullyTranslated(popup, warnings);
  });
}
