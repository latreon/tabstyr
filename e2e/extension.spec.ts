declare const chrome: any;

import { test as base, chromium, expect, type BrowserContext } from '@playwright/test';
import path from 'node:path';

const EXT_PATH = path.resolve('dist/chrome-mv3');

const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      // Capture at 2× device scale so store/review screenshots are retina-crisp.
      // Assertions are CSS-pixel based, so the higher DPI does not affect them.
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
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

// The first-run onboarding modal overlays the dashboard; dismiss it so it
// doesn't intercept clicks or duplicate text matches. It mounts once the
// (async, storage-backed) settings load resolves, so `count()` can read 0
// before it ever appears — checking count synchronously raced the card's
// mount and let it pop in *after* this returned, leaving its backdrop to
// intercept later clicks. Wait for it to actually show up first.
async function dismissOnboarding(page: import('@playwright/test').Page) {
  const dialog = page.getByRole('dialog');
  try {
    await dialog.waitFor({ state: 'visible', timeout: 5_000 });
  } catch {
    return; // never showed (e.g. already onboarded) — nothing to dismiss
  }
  // Escape abandons the tour from any of its 3 steps (same as the ✕ button or a
  // backdrop click) — simpler than walking Next through every step just to reach
  // the final "Got it".
  await page.keyboard.press('Escape');
  // Wait for the card (and its backdrop) to leave the DOM so a following click
  // or visibility check doesn't race the dismissal transition.
  await dialog.waitFor({ state: 'detached' });
}

// Write a single day of activity straight into the extension's IndexedDB so an
// export has something to emit. The data export short-circuits with a toast (no
// download) when zero rows survive, so the export tests must seed first. Assumes
// the dashboard has already created the DB + stores (it runs on page load).
async function seedOneDay(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('tab-time');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (!db.objectStoreNames.contains('dailyDomainStats')) {
      db.close();
      throw new Error('dailyDomainStats store missing — dashboard did not initialize the DB');
    }
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('dailyDomainStats', 'readwrite');
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.objectStore('dailyDomainStats').put({ date, domain: 'github.com', seconds: 600, audioSeconds: 0 });
    });
    db.close();
  });
}

// Playwright-launched Chromium doesn't treat a programmatically opened tab as the
// focused window until it's explicitly brought to front, and the focus-gated
// tracker also needs the service worker already warm (a cold-start focus event is
// dropped). Prime the SW, then open + focus the page so a session opens — this
// mirrors a real user clicking the tab.
async function browseFocused(context: BrowserContext, extensionId: string, url: string) {
  const warm = await context.newPage();
  await warm.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await warm.waitForTimeout(400);
  await warm.close();
  const page = await context.newPage();
  await page.goto(url);
  await page.bringToFront();
  await page.evaluate(() => window.focus());
  await page.waitForTimeout(2_500);
  return page;
}

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
  // JSON is the only backup export format (CSV removed). Restore is the other action.
  await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
  // Separate "export for analysis" pair — flat CSV/JSON of all tracked activity,
  // not the restorable backup above.
  await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export data (JSON)' })).toBeVisible();
});

test('data export CSV button downloads a spreadsheet-ready file', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await dismissOnboarding(page);
  await seedOneDay(page); // export short-circuits with a toast when there are no rows
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^tabstyr-data-\d{4}-\d{2}-\d{2}\.csv$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM so Excel decodes non-ASCII correctly
  expect(csv.replace(/^\uFEFF/, '').split('\r\n')[0]).toBe('period,granularity,domain,category,productivity,active_seconds,active_hm,audio_seconds');
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

test('tracking accumulates time for a browsed tab', async ({ context, extensionId }) => {
  await browseFocused(context, extensionId, 'https://example.com');
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await dismissOnboarding(dash); // onboarding inerts the background, hiding the site list
  await expect(dash.getByText('example.com').first()).toBeVisible({ timeout: 10_000 });
});

test('clicking a tab row focuses that tab', async ({ context, extensionId }) => {
  await browseFocused(context, extensionId, 'https://example.com');
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await dismissOnboarding(dash);
  const row = dash.locator('.tab-row', { hasText: 'example.com' }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
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
    .toContain('example.com');
});

test('screenshots for visual review', async ({ context, extensionId }) => {
  // Local capture utility, not a CI assertion: it navigates to real sites to warm
  // Chrome's favicon cache, which is slow/blocked on CI runners and blows the test
  // timeout. Skip on CI; run locally (`npm run e2e`) to refresh store screenshots.
  test.skip(!!process.env.CI, 'Visual capture — needs real network for favicons; run locally.');
  // Seed a realistic dataset and dismiss onboarding so the captures show a
  // populated dashboard (trend, heatmap, categories, focus, comparison, top
  // sites, work log) rather than an empty first-run state.
  const seeder = await context.newPage();

  // First, warm Chrome's favicon cache by visiting each site, so the _favicon API
  // returns real logos in the captures (a fresh profile has none → generic globe).
  // Done BEFORE seeding so the stray sessions these visits create are wiped by the
  // clear-then-write seed below. Best-effort — falls back to chips if offline.
  for (const d of ['github.com', 'mail.google.com', 'www.reddit.com', 'youtube.com', 'amazon.com']) {
    await seeder.goto(`https://${d}/`, { waitUntil: 'load', timeout: 20_000 }).catch(() => {});
    await seeder.waitForTimeout(1_500); // let Chrome fetch + cache the page favicon
  }

  // Now seed a realistic dataset and dismiss onboarding so the captures show a
  // populated dashboard (trend, heatmap, categories, focus, comparison, top sites,
  // work log) rather than an empty first-run state.
  await seeder.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await seeder.waitForSelector('.bento, .label', { state: 'visible' });
  await seeder.waitForTimeout(1_200); // let the background flush the last warming session
  await seeder.evaluate(async () => {
    await new Promise<void>((res) =>
      chrome.storage.local.set(
        {
          settings: {
            staleDays: 3, idleSeconds: 180, audioEnabled: true, theme: 'system',
            categoryOverrides: {}, categoryRules: [], onboarded: true, language: 'auto',
          },
        },
        () => res(),
      ),
    );

    // domain, seconds/day (active), optional background-audio seconds — chosen so
    // the built-in category rules spread them across Dev/Work/Social/Media/Shopping.
    const sites = [
      { d: 'github.com', s: 5400, h: 10 },
      { d: 'mail.google.com', s: 2700, h: 9 },
      { d: 'www.reddit.com', s: 1500, h: 21 },
      { d: 'youtube.com', s: 1800, a: 1500, h: 20 },
      { d: 'amazon.com', s: 600, h: 13 },
    ];
    const mult = [1, 0.85, 0.95, 1.1, 0.7, 0.5, 1, 0.9, 0.8, 1.05, 0.75, 0.6, 1, 0.9];
    const pad = (n: number) => String(n).padStart(2, '0');
    const dayStart = (off: number) => { const t = new Date(); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - off); return t; };
    const keyOf = (t: Date) => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;

    const stats: Array<Record<string, unknown>> = [];
    const sessions: Array<Record<string, unknown>> = [];
    let tabId = 100;
    for (let off = 0; off < 14; off++) {
      const m = mult[off] ?? 0.9;
      const start0 = dayStart(off).getTime();
      const date = keyOf(dayStart(off));
      for (const site of sites) {
        const seconds = Math.round(site.s * m);
        if (seconds <= 0) continue;
        stats.push({ date, domain: site.d, seconds, audioSeconds: Math.round((site.a ?? 0) * m) });
        const start = start0 + site.h * 3_600_000;
        sessions.push({
          tabId: tabId++, tabKey: `seed-${site.d}-${off}`, url: `https://${site.d}/`,
          domain: site.d, start, end: start + Math.min(seconds, 1800), audio: false,
        });
      }
    }

    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('tab-time');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(['dailyDomainStats', 'sessions'], 'readwrite');
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      const ds = tx.objectStore('dailyDomainStats');
      const ss = tx.objectStore('sessions');
      ds.clear(); // drop any sessions the favicon-warming visits recorded
      ss.clear();
      for (const s of stats) ds.put(s);
      for (const s of sessions) ss.put(s);
    });
    db.close();
  });
  await seeder.close();

  for (const theme of ['dark', 'light'] as const) {
    // ── Dashboard ──────────────────────────────────────────────────────────
    const dash = await context.newPage();
    await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
    // Wait for the Vue app to mount and useTheme's async getSettings().then(apply)
    // to settle BEFORE forcing the theme, otherwise onMounted overwrites it back.
    await dash.waitForSelector('.bento, .label', { state: 'visible' });
    await dash.waitForTimeout(400);
    await dash.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    // Poll until the attribute is actually set (guards against any residual async flush).
    await expect
      .poll(() => dash.evaluate(() => document.documentElement.dataset.theme))
      .toBe(theme);
    // Let any transient toast (e.g. a settings write) clear so it doesn't land in
    // the store capture; then a short settle before the full-page shot.
    await dash.locator('.toast').waitFor({ state: 'detached', timeout: 3_000 }).catch(() => {});
    await dash.waitForTimeout(200);
    await dash.screenshot({ path: `e2e/__screenshots__/dashboard-${theme}.png`, fullPage: true });

    // ── Modals (captured over the dashboard, viewport-only) ──────────────────
    const shootModal = async (name: string) => {
      await dash.evaluate(() => window.scrollTo(0, 0));
      await dash.waitForTimeout(200);
      await dash.screenshot({ path: `e2e/__screenshots__/modal-${name}-${theme}.png` });
    };
    const closeModal = async () => {
      await dash.locator('.backdrop').first().click({ position: { x: 6, y: 6 } }).catch(() => {});
      await dash.waitForSelector('.backdrop', { state: 'hidden' }).catch(() => {});
      await dash.waitForTimeout(200);
    };
    // Domain detail — open from the top of the Top Sites list (github.com).
    await dash.evaluate(() => window.scrollTo(0, 0));
    await dash.locator('.top-sites .row').first().click();
    await dash.waitForSelector('[role="dialog"]', { state: 'visible' });
    await dash.waitForTimeout(300);
    await shootModal('domain');
    await closeModal();
    // Privacy dialog — opened from the header badge.
    await dash.locator('.privacy-badge').click();
    await dash.waitForSelector('.backdrop', { state: 'visible' });
    await dash.waitForTimeout(300);
    await shootModal('privacy');
    await closeModal();
    // Onboarding — replay from Settings (clears `onboarded`); restore it after so
    // the next theme's dashboard capture isn't covered by the first-run card.
    await dash.locator('.intro-link').scrollIntoViewIfNeeded();
    await dash.locator('.intro-link').click();
    await dash.waitForSelector('.backdrop', { state: 'visible' });
    await dash.waitForTimeout(300);
    await shootModal('onboarding');
    await closeModal();
    await dash.evaluate(
      () =>
        new Promise<void>((res) =>
          chrome.storage.local.get('settings', (d: any) => {
            const s = d.settings || {};
            s.onboarded = true;
            chrome.storage.local.set({ settings: s }, () => res());
          }),
        ),
    );

    // ── Popup ──────────────────────────────────────────────────────────────
    const pop = await context.newPage();
    // Set the popup viewport to realistic extension dimensions before navigating.
    await pop.setViewportSize({ width: 360, height: 620 });
    await pop.goto(`chrome-extension://${extensionId}/popup.html`);
    await pop.waitForSelector('.total, .cta', { state: 'visible' });
    await pop.waitForTimeout(400);
    await pop.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    await expect
      .poll(() => pop.evaluate(() => document.documentElement.dataset.theme))
      .toBe(theme);
    await pop.waitForTimeout(200);
    await pop.screenshot({ path: `e2e/__screenshots__/popup-${theme}.png` });
  }
});
