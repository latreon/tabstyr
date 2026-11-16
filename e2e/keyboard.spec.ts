import type { Page } from '@playwright/test';
import { expect, openExtensionPage, readSettings, seedHistory, test, todayKey, writeSettings } from './fixtures';

const history = { dailyStats: [{ date: todayKey(), domain: 'mail.test', seconds: 2_700, audioSeconds: 0 }] };

test.beforeEach(async ({ context }) => {
  await writeSettings(context, { onboarded: true, theme: 'light' });
  await seedHistory(context, history);
  await context.addInitScript(() => localStorage.setItem('tabstyr:dashboardGroups', JSON.stringify({ trends: true, settings: true })));
});

/** Press Tab until `matches` is focused, and return how many presses it took. */
async function tabTo(page: Page, matches: (element: Element) => boolean, limit = 300): Promise<number> {
  const source = matches.toString();
  for (let presses = 1; presses <= limit; presses++) {
    await page.keyboard.press('Tab');
    const found = await page.evaluate((test) => {
      const element = document.activeElement;
      return !!element && new Function(`return (${test})`)()(element);
    }, source);
    if (found) return presses;
  }
  throw new Error('never reached by Tab');
}

/** Interactive elements a mouse user can use, each tagged so the Tab walk can tick it off. */
async function tagInteractive(page: Page): Promise<number> {
  return page.evaluate(() => {
    const candidates = [...document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, summary, [tabindex]')];
    const usable = candidates.filter((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return !element.hasAttribute('disabled') && element.tabIndex >= 0 && box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && !element.closest('[inert], [aria-hidden="true"]');
    });
    usable.forEach((element, index) => (element.dataset.kbd = String(index)));
    return usable.length;
  });
}

test('every control on the dashboard can be reached with Tab and shows a focus ring', async ({ context, extensionId }) => {
  const dashboard = await openExtensionPage(context, extensionId, 'dashboard.html');
  await expect(dashboard.getByText('mail.test').first()).toBeVisible();
  const total = await tagInteractive(dashboard);
  const reached = new Set<string>();
  const withoutRing: string[] = [];

  for (let presses = 0; presses < total * 2 && reached.size < total; presses++) {
    await dashboard.keyboard.press('Tab');
    const focused = await dashboard.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element?.dataset.kbd) return null;
      // A focus indicator is any visible style change on the control or its wrapper.
      const look = () => [element, element.parentElement!].map((node) => {
        const style = getComputedStyle(node);
        return [style.outlineStyle, style.outlineWidth, style.outlineColor, style.boxShadow, style.borderColor, style.backgroundColor].join();
      }).join('|');
      const focusedLook = look();
      element.blur();
      const blurredLook = look();
      element.focus();
      const hasRing = focusedLook !== blurredLook;
      return { id: element.dataset.kbd, hasRing, name: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40) ?? element.tagName };
    });
    if (!focused) continue;
    reached.add(focused.id);
    if (!focused.hasRing) withoutRing.push(focused.name);
  }

  const missed = await dashboard.evaluate(
    (ids) => [...document.querySelectorAll<HTMLElement>('[data-kbd]')].filter((element) => !ids.includes(element.dataset.kbd!)).map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40)),
    [...reached],
  );
  expect(missed, 'controls Tab never reaches').toEqual([]);
  expect([...new Set(withoutRing)], 'controls with no visible focus ring').toEqual([]);
});

test('the privacy dialog opens with Enter, keeps focus inside, and Escape returns focus', async ({ context, extensionId }) => {
  const dashboard = await openExtensionPage(context, extensionId, 'dashboard.html');
  await expect(dashboard.getByText('mail.test').first()).toBeVisible();
  await tabTo(dashboard, (element) => element.classList.contains('privacy-badge'));

  await dashboard.keyboard.press('Enter');
  const dialog = dashboard.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let presses = 0; presses < 15; presses++) {
    await dashboard.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }

  await dashboard.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await dashboard.evaluate(() => document.activeElement?.classList.contains('privacy-badge'))).toBe(true);
});

test('a setting can be changed with the keyboard alone', async ({ context, extensionId }) => {
  const dashboard = await openExtensionPage(context, extensionId, 'dashboard.html');
  await expect(dashboard.getByText('mail.test').first()).toBeVisible();

  await tabTo(dashboard, (element) => element.getAttribute('aria-label') === 'Increase Stale after (days)');
  await dashboard.keyboard.press('Enter');
  await expect.poll(async () => (await readSettings(context)).staleDays).toBe(4);

  await tabTo(dashboard, (element) => element.getAttribute('aria-label')?.startsWith('Theme:') === true);
  await dashboard.keyboard.press('Enter');
  await dashboard.keyboard.press('ArrowDown');
  await dashboard.keyboard.press('Enter');
  await expect(dashboard.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('the popup opens the dashboard with the keyboard', async ({ context, extensionId }) => {
  const popup = await openExtensionPage(context, extensionId, 'popup.html');
  await expect(popup.getByText('mail.test')).toBeVisible();
  await tabTo(popup, (element) => element.classList.contains('cta'));

  const opened = context.waitForEvent('page');
  await popup.keyboard.press('Enter');
  await expect(await opened).toHaveURL(/dashboard\.html/);
});
