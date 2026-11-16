import { existsSync } from 'node:fs';
import type { BrowserContext } from '@playwright/test';
import { expect, openExtensionPage, seedHistory, test, todayKey, writeSettings } from './fixtures';

// Screenshot baselines. Update them with `npx playwright test e2e/visual.spec.ts --update-snapshots`
// after an intended UI change, on both macOS and Linux (CI); see docs/testing/README.md.

const LOCALES = ['en', 'es', 'de', 'fr', 'it', 'pt-BR', 'ru', 'tr', 'ja', 'ko', 'zh-CN'] as const;
const NOW = new Date('2026-06-17T15:00:00');
const SITES = [
  { domain: 'github.test', minutes: 95 },
  { domain: 'mail.test', minutes: 45 },
  { domain: 'reddit.test', minutes: 30 },
  { domain: 'news.test', minutes: 20 },
  { domain: 'shop.test', minutes: 10 },
];

async function seedFixedData(context: BrowserContext) {
  const dailyStats = [];
  const sessions = [];
  for (let back = 0; back < 14; back++) {
    const day = new Date(NOW);
    day.setDate(day.getDate() - back);
    for (const [index, site] of SITES.entries()) {
      // Vary each day a little, the same way every run.
      const seconds = Math.round(site.minutes * 60 * (0.6 + ((back * 7 + index * 3) % 9) / 10));
      dailyStats.push({ date: todayKey(day), domain: site.domain, seconds, audioSeconds: 0 });
      const start = new Date(day);
      start.setHours(9 + index * 2, 0, 0, 0);
      sessions.push({ tabId: index + 1, tabKey: `key-${index}`, url: `http://${site.domain}/`, domain: site.domain, start: start.getTime(), end: start.getTime() + seconds * 1_000, audio: false });
    }
  }
  await seedHistory(context, { dailyStats, sessions });
}

test.beforeEach(async ({ context }) => {
  test.skip(!existsSync(`e2e/visual.spec.ts-snapshots/popup-en-light-${process.platform}.png`), `No ${process.platform} baselines yet.`);
  await context.clock.setFixedTime(NOW);
  await seedFixedData(context);
});

for (const theme of ['light', 'dark'] as const) {
  for (const locale of LOCALES) {
    test(`${locale} ${theme}`, async ({ context, extensionId }) => {
      await writeSettings(context, { language: locale, theme, onboarded: true });

      const dashboard = await openExtensionPage(context, extensionId, 'dashboard.html');
      await expect(dashboard.locator('html')).toHaveAttribute('lang', locale);
      await expect(dashboard.getByText('github.test').first()).toBeVisible();
      await expect(dashboard).toHaveScreenshot(`dashboard-${locale}-${theme}.png`);

      const popup = await openExtensionPage(context, extensionId, 'popup.html');
      await popup.setViewportSize({ width: 360, height: 600 });
      await expect(popup.getByText('github.test')).toBeVisible();
      await expect(popup).toHaveScreenshot(`popup-${locale}-${theme}.png`);
    });
  }
}
