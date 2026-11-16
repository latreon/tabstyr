import { readFileSync } from 'node:fs';
import type { BrowserContext, Page } from '@playwright/test';
import { dismissOnboarding, expect, openExtensionPage, readStore, seedHistory, test, todayKey } from './fixtures';

async function openData(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await openExtensionPage(context, extensionId, 'dashboard.html');
  await dismissOnboarding(page);
  await page.locator('details.group', { hasText: 'Tabs, categories and settings' }).locator('summary').click();
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toBeVisible();
  return page;
}

/** Click a button that downloads a file and return the file's name and text. */
async function download(page: Page, click: () => Promise<void>) {
  const pending = page.waitForEvent('download');
  await click();
  const file = await pending;
  return { name: file.suggestedFilename(), text: readFileSync((await file.path())!, 'utf8') };
}

async function upload(page: Page, name: string, text: string) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Restore…', exact: true }).click();
  await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
}

async function wipe(page: Page) {
  await page.getByRole('button', { name: 'Wipe all data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.getByText('backup-site.test')).toHaveCount(0);
}

const history = { dailyStats: [{ date: todayKey(), domain: 'backup-site.test', seconds: 5_400, audioSeconds: 0 }] };

test('a JSON backup downloaded from the dashboard restores everything after a wipe', async ({ context, extensionId }) => {
  await seedHistory(context, history);
  const page = await openData(context, extensionId);

  const backup = await download(page, () => page.getByRole('button', { name: 'Export JSON', exact: true }).click());
  expect(backup.name).toMatch(/^tabstyr-backup-\d{4}-\d{2}-\d{2}\.json$/);
  expect(JSON.parse(backup.text)).toMatchObject({ app: 'tabstyr', dailyStats: history.dailyStats });

  await wipe(page);
  await upload(page, backup.name, backup.text);
  await page.getByRole('dialog').getByRole('button', { name: 'Replace data' }).click();

  await expect(page.getByText('backup-site.test').first()).toBeVisible();
  expect(await readStore(context, 'dailyDomainStats')).toEqual(history.dailyStats);
});

test('replacing data first saves the current history as a download', async ({ context, extensionId }) => {
  await seedHistory(context, history);
  const page = await openData(context, extensionId);
  const other = JSON.stringify({ app: 'tabstyr', schemaVersion: 3, dailyStats: [{ date: todayKey(), domain: 'other.test', seconds: 60, audioSeconds: 0 }] });
  await upload(page, 'other.json', other);

  const safety = await download(page, () => page.getByRole('dialog').getByRole('button', { name: 'Replace data' }).click());

  expect(safety.name).toMatch(/^tabstyr-before-restore-/);
  expect(JSON.parse(safety.text).dailyStats).toEqual(history.dailyStats);
});

test('an encrypted backup round-trips with its passphrase', async ({ context, extensionId }) => {
  await seedHistory(context, history);
  const page = await openData(context, extensionId);
  await page.getByRole('button', { name: 'Encrypted…', exact: true }).click();
  await page.getByRole('textbox', { name: 'Passphrase', exact: true }).fill('correct horse battery');
  await page.getByRole('textbox', { name: 'Confirm passphrase', exact: true }).fill('correct horse battery');

  const backup = await download(page, () => page.getByRole('button', { name: 'Download encrypted', exact: true }).click());
  expect(backup.name).toMatch(/\.enc\.json$/);
  expect(backup.text).not.toContain('backup-site.test');

  await wipe(page);
  await upload(page, backup.name, backup.text);
  await page.getByRole('textbox', { name: 'Passphrase', exact: true }).fill('correct horse battery');
  await page.getByRole('button', { name: 'Decrypt', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Replace data' }).click();

  await expect(page.getByText('backup-site.test').first()).toBeVisible();
});
