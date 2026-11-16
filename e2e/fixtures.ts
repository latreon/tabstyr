declare const chrome: any;

import { test as base, chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

export const EXT_PATH = path.resolve('dist/chrome-mv3');

// Local fixture pages. Every `*.test` host maps to this server (see launchExtension),
// so tests browse real-looking domains like http://news.test/ with no network.
const SPA_SCRIPT = `
  const go = (path) => history.pushState({}, '', path);
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-push]');
    if (link) { event.preventDefault(); go(link.dataset.push); }
  });
`;
function page(title: string, body: string, script = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}<script>${script}</script></body></html>`;
}
const PAGES: Record<string, () => string> = {
  '/': () => page('Home', '<h1>Home</h1>'),
  '/spa': () => page('SPA', '<a href="/spa/one" data-push="/spa/one">One</a> <a href="/spa/two" data-push="/spa/two">Two</a>', SPA_SCRIPT),
  '/frame': () => page('Frame', '<h1>Frame host</h1><iframe src="/spa" title="inner"></iframe>'),
  '/csp': () => page('CSP', '<h1>Strict CSP</h1>'),
};
const SLOW_MS = 1_500;

export interface Site {
  port: number;
  url: (host: string, pathname?: string) => string;
}

export interface LaunchOptions {
  site: Site;
  userDataDir?: string;
  extPath?: string;
  viewport?: { width: number; height: number };
  colorScheme?: 'light' | 'dark';
}

export async function launchExtension({ site, userDataDir = '', extPath = EXT_PATH, viewport = { width: 1280, height: 900 }, colorScheme = 'light' }: LaunchOptions) {
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    viewport,
    colorScheme,
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
      `--host-resolver-rules=MAP *.test 127.0.0.1:${site.port}`,
    ],
  });
}

export async function extensionIdOf(context: BrowserContext): Promise<string> {
  return (await serviceWorker(context)).url().split('/')[2]!;
}

/** The running service worker, waiting for it to (re)start when the browser stopped it. */
export async function serviceWorker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
}

/** Run code inside the extension's service worker. */
export async function inWorker<R, A>(context: BrowserContext, fn: (arg: A) => R | Promise<R>, arg?: A): Promise<R> {
  return (await serviceWorker(context)).evaluate(fn as any, arg);
}

export interface StoredSession {
  tabKey: string;
  url: string;
  domain: string;
  start: number;
  end: number;
  audio: boolean;
}

export function readStore<T>(context: BrowserContext, store: 'sessions' | 'dailyDomainStats' | 'tabMeta'): Promise<T[]> {
  return inWorker(
    context,
    (name: string) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('tab-time');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db.transaction(name).objectStore(name).getAll();
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
          request.onerror = () => reject(request.error);
        };
      }),
    store,
  );
}

export const readSessions = (context: BrowserContext) => readStore<StoredSession>(context, 'sessions');

/** The page the tracker currently counts as focused (null when nothing is). */
export async function focusedUrl(context: BrowserContext): Promise<string | null> {
  return inWorker(context, async () => (await chrome.storage.session.get('engineState')).engineState?.focused?.url ?? null);
}

export function readSettings(context: BrowserContext): Promise<Record<string, unknown>> {
  return inWorker(context, async () => (await chrome.storage.local.get('settings')).settings ?? {});
}

export async function writeSettings(context: BrowserContext, patch: Record<string, unknown>): Promise<void> {
  await inWorker(
    context,
    async (values: Record<string, unknown>) => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, ...values } });
    },
    patch,
  );
}

/** Seed daily totals (and optional sessions) the way the tracker stores them. */
export async function seedHistory(context: BrowserContext, data: { dailyStats?: unknown[]; sessions?: unknown[] }): Promise<void> {
  await inWorker(
    context,
    (rows: { dailyStats?: unknown[]; sessions?: unknown[] }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('tab-time');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['dailyDomainStats', 'sessions'], 'readwrite');
          for (const row of rows.dailyStats ?? []) tx.objectStore('dailyDomainStats').put(row);
          for (const row of rows.sessions ?? []) tx.objectStore('sessions').add(row);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    data,
  );
}

export function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Bring a tab to the front of a focused window. Playwright's browser window is not
 * focused by the OS, and the tracker only counts the focused window, so focus it the
 * way a user's click would.
 */
export async function focusTab(context: BrowserContext, tab: Page): Promise<void> {
  await tab.bringToFront();
  await inWorker(
    context,
    async (url: string) => {
      const [match] = await chrome.tabs.query({ url });
      await chrome.tabs.update(match.id, { active: true });
      await chrome.windows.update(match.windowId, { focused: true });
    },
    tab.url(),
  );
}

/**
 * With no human at the keyboard the OS reports "idle", and Chrome sends that once,
 * shortly after the worker registers its listener. Wait until the tracker has seen
 * it, so it can't close a session in the middle of a test. A focus clears it again.
 */
export async function settleIdle(context: BrowserContext): Promise<void> {
  await expect
    .poll(() => inWorker(context, async () => {
      const osIdle = (await chrome.idle.queryState(180)) !== 'active';
      const { engineState } = await chrome.storage.session.get('engineState');
      return osIdle === !!engineState?.isIdle;
    }), { timeout: 10_000 })
    .toBe(true);
}

/** Wait until the open session is old enough to be kept (the tracker drops visits under 250 ms). */
export async function dwell(context: BrowserContext, ms = 400): Promise<void> {
  await expect
    .poll(() => inWorker(context, async () => {
      const { engineState } = await chrome.storage.session.get('engineState');
      return engineState?.focused ? Date.now() - engineState.focused.start : -1;
    }))
    .toBeGreaterThanOrEqual(ms);
}

/** Open a web page in a new focused tab and wait until the tracker counts it. */
export async function browse(context: BrowserContext, url: string): Promise<Page> {
  await serviceWorker(context);
  const tab = await context.newPage();
  await tab.goto(url);
  await focusTab(context, tab);
  await expect.poll(() => focusedUrl(context), { message: `tracker never focused ${url}` }).toBe(url);
  await dwell(context);
  return tab;
}

export async function openExtensionPage(context: BrowserContext, extensionId: string, file: 'dashboard.html' | 'popup.html'): Promise<Page> {
  const tab = await context.newPage();
  await tab.goto(`chrome-extension://${extensionId}/${file}`);
  return tab;
}

/** Close the first-run intro when it shows, and wait until the page is usable. */
export async function dismissOnboarding(dashboard: Page): Promise<void> {
  await expect(dashboard.locator('.hero-tile, .load-error')).toBeVisible();
  const intro = dashboard.getByRole('dialog', { name: /welcome/i });
  if (await intro.isVisible()) {
    await dashboard.keyboard.press('Escape');
    await intro.waitFor({ state: 'detached' });
  }
}

export const test = base.extend<{ context: BrowserContext; extensionId: string }, { site: Site }>({
  site: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const server = createServer((request, response) => {
        const { pathname } = new URL(request.url ?? '/', 'http://localhost');
        const body = PAGES[pathname]?.();
        const send = () => {
          if (!body && pathname !== '/slow') {
            response.writeHead(404).end();
            return;
          }
          response.writeHead(200, {
            'content-type': 'text/html; charset=utf-8',
            ...(pathname === '/csp' ? { 'content-security-policy': "default-src 'none'" } : {}),
          });
          response.end(body ?? page('Slow', '<h1>Slow</h1>'));
        };
        if (pathname === '/slow') setTimeout(send, SLOW_MS);
        else send();
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address() as AddressInfo;
      await use({ port, url: (host, pathname = '/') => `http://${host}.test${pathname}` });
      server.close();
    },
    { scope: 'worker' },
  ],
  context: async ({ site }, use) => {
    const context = await launchExtension({ site });
    // A fresh install opens the dashboard in a new tab. Wait for it, otherwise it can
    // become the active tab in the middle of a test.
    if (!context.pages().some((tab) => tab.url().endsWith('/dashboard.html'))) await context.waitForEvent('page');
    await settleIdle(context);
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    await use(await extensionIdOf(context));
  },
});

export { expect };
