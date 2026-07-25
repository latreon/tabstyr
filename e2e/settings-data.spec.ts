import { test as base, chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';

// The destructive / data-moving settings flows had no end-to-end cover at all —
// backup restore, merge, CSV import and wipe are the paths where a bug costs a user
// their history, so they are exactly the ones worth driving in a real browser.

const EXT_PATH = path.resolve('dist/chrome-mv3');

const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      viewport: { width: 1280, height: 900 },
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

async function openDashboard(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  // Onboarding inerts the rest of the page until dismissed.
  const dialog = page.getByRole('dialog');
  try {
    await dialog.waitFor({ state: 'visible', timeout: 5_000 });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
  } catch {
    /* already onboarded */
  }
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toBeVisible({ timeout: 10_000 });
  return page;
}

/** A minimal but valid backup, with a day of history the dashboard will show. */
function backupJson(seconds = 3600): string {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return JSON.stringify({
    app: 'tabstyr',
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    dailyStats: [{ date, domain: 'restored-site.com', seconds, audioSeconds: 0 }],
    monthlyStats: [],
    sessions: [],
    tabMeta: [],
    settings: {},
  });
}

/** Feed a file to the panel's hidden <input type=file> for the given picker button. */
async function pickFile(page: Page, buttonName: string, name: string, mime: string, body: string) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: buttonName, exact: true }).click();
  const fileChooser = await chooser;
  await fileChooser.setFiles({ name, mimeType: mime, buffer: Buffer.from(body) });
}

test('restore replaces history after an explicit confirmation', async ({ context, extensionId }) => {
  const page = await openDashboard(context, extensionId);
  await pickFile(page, 'Restore…', 'backup.json', 'application/json', backupJson());

  // Nothing is written until the user chooses in the confirmation dialog.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('1'); // one day of stats in the file
  await dialog.getByRole('button', { name: 'Replace data' }).click();

  await expect(page.getByText('restored-site.com').first()).toBeVisible({ timeout: 10_000 });
});

test('restore can be cancelled and changes nothing', async ({ context, extensionId }) => {
  const page = await openDashboard(context, extensionId);
  await pickFile(page, 'Restore…', 'backup.json', 'application/json', backupJson());
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('restored-site.com')).toHaveCount(0);
});

test('merge keeps existing data and folds the backup in', async ({ context, extensionId }) => {
  const page = await openDashboard(context, extensionId);
  // First replace, so there is something to merge INTO.
  await pickFile(page, 'Restore…', 'first.json', 'application/json', backupJson(3600));
  await page.getByRole('dialog').getByRole('button', { name: 'Replace data' }).click();
  await expect(page.getByText('restored-site.com').first()).toBeVisible({ timeout: 10_000 });

  // Then merge a second file naming a different site; both must survive.
  const second = backupJson(1800).replace('restored-site.com', 'merged-site.com');
  await pickFile(page, 'Restore…', 'second.json', 'application/json', second);
  await page.getByRole('dialog').getByRole('button', { name: 'Merge' }).click();

  await expect(page.getByText('merged-site.com').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('restored-site.com').first()).toBeVisible();
});

test('a corrupt backup is refused with a message, not a crash', async ({ context, extensionId }) => {
  const page = await openDashboard(context, extensionId);
  await pickFile(page, 'Restore…', 'bad.json', 'application/json', '{"app":"something-else"}');
  await expect(page.getByRole('dialog')).toHaveCount(0); // never reaches confirmation
  await expect(page.locator('.rule-error')).toBeVisible();
});

test('CSV import seeds estimated history without a confirmation step', async ({ context, extensionId }) => {
  const page = await openDashboard(context, extensionId);
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await pickFile(
    page,
    'Import CSV',
    'rescuetime.csv',
    'text/csv',
    `Date,Activity,Time Spent (seconds)\n${date},imported-site.com,2400\n`,
  );
  await expect(page.getByText('imported-site.com').first()).toBeVisible({ timeout: 10_000 });
});

test('wipe clears everything, and only after confirmation', async ({ context, extensionId }) => {
  const page = await openDashboard(context, extensionId);
  await pickFile(page, 'Restore…', 'backup.json', 'application/json', backupJson());
  await page.getByRole('dialog').getByRole('button', { name: 'Replace data' }).click();
  await expect(page.getByText('restored-site.com').first()).toBeVisible({ timeout: 10_000 });

  // Opening the confirmation must not wipe on its own.
  await page.getByRole('button', { name: 'Wipe all data' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByText('restored-site.com').first()).toBeVisible();

  // Confirming does.
  await page.getByRole('button', { name: 'Wipe all data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.getByText('restored-site.com')).toHaveCount(0, { timeout: 10_000 });
});

test('the encrypted export enforces its passphrase rules', async ({ context, extensionId }) => {
  const page = await openDashboard(context, extensionId);
  await page.getByRole('button', { name: 'Encrypted…', exact: true }).click();
  const pass = page.getByLabel('Passphrase', { exact: true });
  const confirm = page.getByLabel('Confirm passphrase');
  const submit = page.getByRole('button', { name: 'Download encrypted' });

  // Too short → refused, with a visible reason.
  await pass.fill('short');
  await confirm.fill('short');
  await submit.click();
  await expect(page.locator('.rule-error')).toBeVisible();

  // Long enough but mismatched → still refused.
  await pass.fill('correct-horse-battery');
  await confirm.fill('correct-horse-batteryX');
  await submit.click();
  await expect(page.locator('.rule-error')).toBeVisible();

  // Valid and matching → the form closes, meaning the envelope was produced and
  // handed to the browser. (The download itself is asserted in the unit tests for
  // lib/crypto; observing it here is flaky from an extension page.)
  await confirm.fill('correct-horse-battery');
  await submit.click();
  await expect(submit).toBeHidden({ timeout: 15_000 });
});
