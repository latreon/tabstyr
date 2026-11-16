declare const chrome: any;

import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { browse, EXT_PATH, expect, extensionIdOf, inWorker, launchExtension, readSessions, readSettings, settleIdle, test, writeSettings } from './fixtures';

// Path to an unpacked build of the previous release (e.g. `git worktree add <dir> v2.1.0`
// and `wxt build` there). Chrome keys an unpacked extension by its folder, so the
// update is simulated by swapping the files in one folder between two launches.
const OLD_BUILD = process.env.E2E_OLD_EXTENSION;

test('updating from the previous release keeps history and settings', async ({ site }) => {
  test.skip(!OLD_BUILD, 'Set E2E_OLD_EXTENSION to an unpacked build of the previous release.');
  const root = mkdtempSync(path.join(tmpdir(), 'tabstyr-update-'));
  const extPath = path.join(root, 'extension');
  const userDataDir = path.join(root, 'profile');
  try {
    cpSync(OLD_BUILD!, extPath, { recursive: true });
    let context = await launchExtension({ site, userDataDir, extPath });
    const oldVersion = await inWorker(context, () => chrome.runtime.getManifest().version);
    if (!context.pages().some((tab) => tab.url().endsWith('/dashboard.html'))) await context.waitForEvent('page');
    await settleIdle(context);
    const tab = await browse(context, site.url('news'));
    await tab.close();
    await expect.poll(async () => (await readSessions(context)).length).toBeGreaterThan(0);
    await writeSettings(context, { staleDays: 9, excludedDomains: ['secret.test'] });
    const sessionsBefore = await readSessions(context);
    await context.close();

    rmSync(extPath, { recursive: true });
    cpSync(EXT_PATH, extPath, { recursive: true });
    context = await launchExtension({ site, userDataDir, extPath });
    const newVersion = await inWorker(context, () => chrome.runtime.getManifest().version);

    expect(newVersion).not.toBe(oldVersion);
    expect(await readSessions(context)).toEqual(sessionsBefore);
    expect(await readSettings(context)).toMatchObject({ staleDays: 9, excludedDomains: ['secret.test'] });
    // Not checked here: an extension loaded with --load-extension gets onInstalled
    // with reason 'install' on every launch, so the dashboard opens again. The
    // install-vs-update handling is covered in tests/entrypoints/background.test.ts.

    const dashboard = await context.newPage();
    await dashboard.goto(`chrome-extension://${await extensionIdOf(context)}/dashboard.html`);
    await expect(dashboard.getByText('news.test').first()).toBeVisible();
    await context.close();
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
});
