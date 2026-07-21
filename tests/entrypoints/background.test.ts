import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { resetDBConnection } from '@/lib/db/db';
import * as repo from '@/lib/db/repo';
import { invalidateSettings, saveSettings } from '@/lib/settings';
import background from '@/entrypoints/background';

const DAY_MS = 86_400_000;

// fake-browser implements every webextension-polyfill method it doesn't
// explicitly mock as a throwing "not implemented" stub — including
// `runtime.setUninstallURL`, which every real browser provides. Stub it the
// same way a real browser always would, so `background.main()` doesn't throw
// on the line that wires up uninstall feedback.
function stubUninstallUrl() {
  return vi.spyOn(fakeBrowser.runtime, 'setUninstallURL').mockResolvedValue();
}

// Same gap as setUninstallURL above: fake-browser has an `idle` namespace but
// never implemented `onStateChanged.addListener`, so registering it throws.
// None of these tests drive idle events, so a no-op listener is enough.
function stubIdleApi() {
  vi.spyOn(fakeBrowser.idle.onStateChanged, 'addListener').mockImplementation(() => {});
  vi.spyOn(fakeBrowser.idle, 'setDetectionInterval').mockImplementation(() => {});
}

// Same gap again: fake-browser never implemented `tabs.onReplaced` (Chromium's
// prerender/discard id-swap event). None of these tests exercise it.
function stubOnReplaced() {
  return vi.spyOn(fakeBrowser.tabs.onReplaced, 'addListener').mockImplementation(() => {});
}

// isInFocusedWindow() asks `browser.windows.getLastFocused()` for the
// currently-focused window. fake-browser's window-focus bookkeeping only
// updates via `windows.create({ focused: true })`, which can't reproduce "this
// window is currently focused" for a tab created without a real window — so
// tests that need tracking to actually start stub this call directly instead
// of fighting the fake implementation's internal state machine.
function focusWindow(windowId: number) {
  return vi.spyOn(fakeBrowser.windows, 'getLastFocused').mockResolvedValue({
    id: windowId,
    focused: true,
    alwaysOnTop: false,
    incognito: false,
  } as never);
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory(); // fresh DB per test
  resetDBConnection();
  fakeBrowser.reset();
  invalidateSettings(); // drop settings.ts's in-process cache between tests
  stubUninstallUrl();
  stubIdleApi();
  stubOnReplaced();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('background: lifecycle', () => {
  test('fresh install opens the dashboard and records the install date', async () => {
    background.main();
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install', temporary: false });

    await vi.waitFor(async () => {
      const tabs = await fakeBrowser.tabs.query({});
      expect(tabs.some((t) => t.url?.includes('/dashboard.html'))).toBe(true);
    });
    await vi.waitFor(async () => {
      const { installedAt } = await fakeBrowser.storage.local.get('installedAt');
      expect(typeof installedAt).toBe('number');
    });
  });

  test('an update never reopens the dashboard tab or records a fresh install date', async () => {
    background.main();
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update', temporary: false });

    const tabs = await fakeBrowser.tabs.query({});
    expect(tabs.some((t) => t.url?.includes('/dashboard.html'))).toBe(false);
    const { installedAt } = await fakeBrowser.storage.local.get('installedAt');
    expect(installedAt).toBeUndefined();
  });

  test('registers the uninstall feedback URL so leaving opens the feedback form', () => {
    background.main();
    expect(fakeBrowser.runtime.setUninstallURL).toHaveBeenCalledWith('https://tabstyr.com/ideas?src=uninstall');
  });
});

describe('background: alarms', () => {
  test('arms a 1-minute heartbeat and a once-a-day maintenance alarm', async () => {
    background.main();
    await vi.waitFor(async () => {
      const all = await fakeBrowser.alarms.getAll();
      expect(all.map((a) => a.name).sort()).toEqual(['daily', 'heartbeat']);
    });
    expect((await fakeBrowser.alarms.get('heartbeat'))?.periodInMinutes).toBe(1);
    expect((await fakeBrowser.alarms.get('daily'))?.periodInMinutes).toBe(60 * 24);
  });

  test('a second worker wake does not re-arm (duplicate) the alarms', async () => {
    background.main();
    await vi.waitFor(async () => expect((await fakeBrowser.alarms.getAll()).length).toBe(2));

    background.main(); // simulates the service worker being woken again
    await vi.waitFor(async () => expect((await fakeBrowser.alarms.getAll()).length).toBe(2));
  });
});

describe('background: daily maintenance', () => {
  async function seedStaleTab(lastActiveAt: number) {
    const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/' });
    await repo.upsertTabMeta({
      tabId: tab.id!,
      key: 'stable-key',
      url: 'https://example.com/',
      title: 'Example',
      lastActiveAt,
      createdAt: lastActiveAt,
    });
    return tab;
  }

  test('notifies once a tracked tab has gone untouched past the stale threshold', async () => {
    await saveSettings({ staleDays: 3, notificationsEnabled: true });
    await seedStaleTab(Date.now() - 4 * DAY_MS);

    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'daily', scheduledTime: Date.now() });

    await vi.waitFor(async () => {
      const all = await fakeBrowser.notifications.getAll();
      expect(Object.keys(all)).toContain('tab-time-stale');
    });
  });

  test('does not notify when notifications are disabled in settings', async () => {
    await saveSettings({ staleDays: 3, notificationsEnabled: false });
    await seedStaleTab(Date.now() - 4 * DAY_MS);

    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'daily', scheduledTime: Date.now() });

    // Give any (wrongly-fired) notification a chance to land before asserting absence.
    await new Promise((r) => setTimeout(r, 20));
    const all = await fakeBrowser.notifications.getAll();
    expect(Object.keys(all)).not.toContain('tab-time-stale');
  });

  test('does not re-notify for the same stale tab twice in one day', async () => {
    await saveSettings({ staleDays: 3, notificationsEnabled: true });
    await seedStaleTab(Date.now() - 4 * DAY_MS);

    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'daily', scheduledTime: Date.now() });
    await vi.waitFor(async () => {
      expect(Object.keys(await fakeBrowser.notifications.getAll())).toContain('tab-time-stale');
    });

    await fakeBrowser.notifications.clear('tab-time-stale');
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'daily', scheduledTime: Date.now() });
    await new Promise((r) => setTimeout(r, 20));
    expect(Object.keys(await fakeBrowser.notifications.getAll())).not.toContain('tab-time-stale');
  });
});

describe('background: scheduled export', () => {
  test('does nothing when autoExportDays is 0 (the default)', async () => {
    const download = vi.spyOn(fakeBrowser.downloads, 'download').mockResolvedValue(1);
    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'daily', scheduledTime: Date.now() });
    await new Promise((r) => setTimeout(r, 20));
    expect(download).not.toHaveBeenCalled();
  });

  test('downloads a backup on the first due daily check', async () => {
    await saveSettings({ autoExportDays: 7 });
    const download = vi.spyOn(fakeBrowser.downloads, 'download').mockResolvedValue(1);
    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'daily', scheduledTime: Date.now() });
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));

    const [opts] = download.mock.calls[0];
    expect(opts.filename).toMatch(/^tabstyr-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(opts.url).toMatch(/^data:application\/json;base64,/);
    expect(opts.saveAs).toBe(false);

    const { autoExportState } = await fakeBrowser.storage.local.get('autoExportState');
    expect((autoExportState as { lastExportAt: number }).lastExportAt).toBeGreaterThan(0);
  });

  test('does not re-download before the interval has elapsed', async () => {
    await saveSettings({ autoExportDays: 7 });
    await fakeBrowser.storage.local.set({ autoExportState: { lastExportAt: Date.now() - 2 * DAY_MS } });
    const download = vi.spyOn(fakeBrowser.downloads, 'download').mockResolvedValue(1);
    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'daily', scheduledTime: Date.now() });
    await new Promise((r) => setTimeout(r, 20));
    expect(download).not.toHaveBeenCalled();
  });

  test('downloads again once the interval has elapsed', async () => {
    await saveSettings({ autoExportDays: 7 });
    await fakeBrowser.storage.local.set({ autoExportState: { lastExportAt: Date.now() - 8 * DAY_MS } });
    const download = vi.spyOn(fakeBrowser.downloads, 'download').mockResolvedValue(1);
    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'daily', scheduledTime: Date.now() });
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  });

  test('the exported backup contains the actual stored data', async () => {
    await saveSettings({ autoExportDays: 1 });
    await repo.upsertTabMeta({ tabId: 1, key: 'k1', url: 'https://a.com', title: 'A', lastActiveAt: Date.now(), createdAt: Date.now() });
    const download = vi.spyOn(fakeBrowser.downloads, 'download').mockResolvedValue(1);
    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'daily', scheduledTime: Date.now() });
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));

    const [opts] = download.mock.calls[0];
    const base64 = opts.url.slice('data:application/json;base64,'.length);
    const parsed = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    expect(parsed.app).toBe('tabstyr');
    expect(parsed.tabMeta).toHaveLength(1);
    expect(parsed.tabMeta[0].url).toBe('https://a.com');
  });
});

describe('background: onMessage', () => {
  test('wipe-data from the extension itself clears all stored data', async () => {
    await repo.upsertTabMeta({ tabId: 1, key: 'k1', url: 'https://a.com', title: 'A', lastActiveAt: Date.now(), createdAt: Date.now() });
    background.main();

    await fakeBrowser.runtime.onMessage.trigger({ type: 'wipe-data' }, { id: fakeBrowser.runtime.id });

    await vi.waitFor(async () => {
      expect(await repo.getAllTabMeta()).toEqual([]);
    });
  });

  test('ignores a wipe-data message from a different extension', async () => {
    await repo.upsertTabMeta({ tabId: 1, key: 'k1', url: 'https://a.com', title: 'A', lastActiveAt: Date.now(), createdAt: Date.now() });
    background.main();

    await fakeBrowser.runtime.onMessage.trigger({ type: 'wipe-data' }, { id: 'some-other-extension' });

    await new Promise((r) => setTimeout(r, 20));
    expect(await repo.getAllTabMeta()).toHaveLength(1);
  });
});

describe('background: tab tracking wiring', () => {
  test('activating a tab in the focused window starts a session a later heartbeat commits to the database', async () => {
    const start = Date.parse('2026-07-15T10:00:00Z');
    const now = vi.spyOn(Date, 'now').mockReturnValue(start);
    focusWindow(0); // DEFAULT_WINDOW's id — matches the tab created below

    background.main();
    const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/' });
    await fakeBrowser.tabs.onActivated.trigger({ tabId: tab.id!, windowId: tab.windowId! });

    now.mockReturnValue(start + 5 * 60_000); // 5 minutes of active time
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'heartbeat', scheduledTime: Date.now() });

    await vi.waitFor(async () => {
      const sessions = await repo.getAllSessions();
      expect(sessions.length).toBeGreaterThan(0);
    });
    const sessions = await repo.getAllSessions();
    const totalMs = sessions.reduce((sum, s) => sum + (s.end - s.start), 0);
    expect(totalMs).toBeGreaterThanOrEqual(4 * 60_000);
  });

  test('activating a tab in a background (non-focused) window records its metadata but starts no session', async () => {
    const start = Date.parse('2026-07-15T10:00:00Z');
    vi.spyOn(Date, 'now').mockReturnValue(start);
    // fake-browser's own default `getLastFocused()` returns a bare `undefined`
    // instead of a resolved promise (unlike every real browser), which breaks
    // the `.catch()` call in `isInFocusedWindow`. Stub it to resolve to nothing
    // instead, so this test exercises the intended "no focused window" branch
    // rather than fake-browser's own gap.
    vi.spyOn(fakeBrowser.windows, 'getLastFocused').mockResolvedValue(undefined as never);
    background.main();

    const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/' });
    await fakeBrowser.tabs.onActivated.trigger({ tabId: tab.id!, windowId: tab.windowId! });

    await vi.waitFor(async () => {
      const meta = await repo.getTabMeta(tab.id!);
      expect(meta?.url).toBe('https://example.com/');
    });
    expect(await repo.getAllSessions()).toEqual([]);
  });

  test('flushes the open session on worker suspend so at most the last heartbeat is lost', async () => {
    const start = Date.parse('2026-07-15T10:00:00Z');
    const now = vi.spyOn(Date, 'now').mockReturnValue(start);
    focusWindow(0);

    background.main();
    const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/' });
    await fakeBrowser.tabs.onActivated.trigger({ tabId: tab.id!, windowId: tab.windowId! });

    now.mockReturnValue(start + 30_000); // 30s later, no heartbeat has fired yet
    fakeBrowser.runtime.onSuspend.trigger();

    await vi.waitFor(async () => {
      const sessions = await repo.getAllSessions();
      expect(sessions.length).toBeGreaterThan(0);
    });
    const sessions = await repo.getAllSessions();
    const totalMs = sessions.reduce((sum, s) => sum + (s.end - s.start), 0);
    expect(totalMs).toBeGreaterThanOrEqual(25_000);
  });
});
