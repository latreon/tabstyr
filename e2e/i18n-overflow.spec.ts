/* eslint-disable */
declare const chrome: any;

// Renders the dashboard + popup in the longest-string locale (German) and a CJK
// locale (Japanese) at several widths. It both (a) captures screenshots under
// e2e/__screenshots__/i18n/ for visual review AND (b) asserts that no surface
// overflows horizontally — a long translation that breaks the layout fails CI
// rather than only showing up in a screenshot nobody opens.
import { test as base, chromium, expect, type BrowserContext } from '@playwright/test';
import path from 'node:path';

const EXT_PATH = path.resolve('dist/chrome-mv3');

// Horizontal page overflow = a translated string forced a surface wider than the
// viewport (the canonical "i18n broke the layout" signal). 1px tolerance absorbs
// sub-pixel rounding. Truncated-with-ellipsis text is fine — it clips inside its
// own box and does not widen the page.
async function pageOverflow(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
}

const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
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

async function seed(page: import('@playwright/test').Page, language: string) {
  await page.evaluate(async (lang) => {
    await new Promise<void>((res) =>
      chrome.storage.local.set(
        {
          settings: {
            staleDays: 3, idleSeconds: 180, audioEnabled: true, theme: 'system',
            categoryOverrides: {}, categoryRules: [], onboarded: true, language: lang,
          },
        },
        () => res(),
      ),
    );
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
    const stats: any[] = [];
    const sessions: any[] = [];
    let tabId = 100;
    for (let off = 0; off < 14; off++) {
      const m = mult[off] ?? 0.9;
      const start0 = dayStart(off).getTime();
      const date = keyOf(dayStart(off));
      for (const site of sites) {
        const seconds = Math.round(site.s * m);
        if (seconds <= 0) continue;
        stats.push({ date, domain: site.d, seconds, audioSeconds: Math.round(((site as any).a ?? 0) * m) });
        const start = start0 + site.h * 3_600_000;
        // Seed a couple of sub-pages so the Top-pages section renders.
        for (const p of ['/', '/watch', '/feed']) {
          sessions.push({
            tabId: tabId++, tabKey: `seed-${site.d}-${off}-${p}`, url: `https://${site.d}${p}`,
            domain: site.d, start, end: start + Math.min(seconds, 600), audio: false,
          });
        }
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
      ds.clear(); ss.clear();
      for (const s of stats) ds.put(s);
      for (const s of sessions) ss.put(s);
    });
    db.close();
  }, language);
}

// de = longest Latin compounds, ja = CJK, ru = Cyrillic, tr = long Latin + dotted İ.
for (const lang of ['de', 'ja', 'ru', 'tr'] as const) {
  test(`i18n overflow — ${lang}`, async ({ context, extensionId }) => {
    const seeder = await context.newPage();
    await seeder.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await seeder.waitForSelector('.bento, .label', { state: 'visible' });
    await seed(seeder, lang);
    await seeder.close();

    for (const width of [1440, 768, 380]) {
      const dash = await context.newPage();
      await dash.setViewportSize({ width, height: 1400 });
      await dash.goto(`chrome-extension://${extensionId}/dashboard.html`);
      await dash.waitForSelector('.bento, .label', { state: 'visible' });
      await dash.waitForTimeout(700); // let locale + data settle
      await dash.screenshot({ path: `e2e/__screenshots__/i18n/dashboard-${lang}-${width}.png`, fullPage: true });
      // No surface may overflow horizontally at any tested width — a translation
      // that breaks the layout (or a regression in the responsive bento grid)
      // fails here rather than only showing up in a screenshot.
      expect(await pageOverflow(dash), `dashboard overflows horizontally at ${width}px (${lang})`).toBeLessThanOrEqual(1);

      // Open a site's detail modal to capture the Top-pages / long-label layout.
      if (width === 380) {
        const row = dash.locator('.tab-row, .site-row, [class*="row"]').first();
        if (await row.count()) {
          await row.click().catch(() => {});
          await dash.waitForTimeout(400);
          await dash.screenshot({ path: `e2e/__screenshots__/i18n/detail-${lang}-${width}.png`, fullPage: true });
        }
      }
      await dash.close();
    }

    const pop = await context.newPage();
    await pop.setViewportSize({ width: 360, height: 620 });
    await pop.goto(`chrome-extension://${extensionId}/popup.html`);
    await pop.waitForSelector('.total, .cta', { state: 'visible' });
    await pop.waitForTimeout(600);
    await pop.screenshot({ path: `e2e/__screenshots__/i18n/popup-${lang}.png` });
    expect(await pageOverflow(pop), `popup overflows horizontally (${lang})`).toBeLessThanOrEqual(1);
    await pop.close();
  });
}
