import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { resetDBConnection } from '@/lib/db/db';
import * as repo from '@/lib/db/repo';
import { invalidateSettings, saveSettings } from '@/lib/settings';
import { dateKey } from '@/lib/time';
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
  invalidateSettings();
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
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install' });

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
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update' });

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

describe('background: heartbeat side-checks survive worker restarts', () => {
  // An MV3 worker is evicted ~30s after each event, so nearly every 1-minute
  // heartbeat runs in a FRESH worker. Anything gated on a per-worker counter
  // ("every Nth heartbeat") therefore never fires in practice — these tests pin the
  // behaviour to a single heartbeat of a single worker lifetime.
  async function seedTodaySocialTime(seconds: number) {
    await repo.applyDailyStatsMax([
      { date: dateKey(Date.now()), domain: 'reddit.com', seconds, audioSeconds: 0 },
    ]);
  }

  test('a budget nudge fires on the FIRST heartbeat of a fresh worker', async () => {
    await saveSettings({ notificationsEnabled: true, categoryBudgets: { Social: 1 } });
    await seedTodaySocialTime(120); // 2 min against a 1-min budget

    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'heartbeat', scheduledTime: Date.now() });

    await vi.waitFor(async () => {
      expect(Object.keys(await fakeBrowser.notifications.getAll())).toContain('tab-time-budget');
    });
  });

  test('the budget nudge still fires at most once a day', async () => {
    await saveSettings({ notificationsEnabled: true, categoryBudgets: { Social: 1 } });
    await seedTodaySocialTime(120);

    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'heartbeat', scheduledTime: Date.now() });
    await vi.waitFor(async () => {
      expect(Object.keys(await fakeBrowser.notifications.getAll())).toContain('tab-time-budget');
    });

    await fakeBrowser.notifications.clear('tab-time-budget');
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'heartbeat', scheduledTime: Date.now() });
    await new Promise((r) => setTimeout(r, 20));
    expect(Object.keys(await fakeBrowser.notifications.getAll())).not.toContain('tab-time-budget');
  });

  test('no nudge when no budget is configured', async () => {
    await saveSettings({ notificationsEnabled: true });
    await seedTodaySocialTime(3600);

    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'heartbeat', scheduledTime: Date.now() });
    await new Promise((r) => setTimeout(r, 20));
    expect(Object.keys(await fakeBrowser.notifications.getAll())).not.toContain('tab-time-budget');
  });

  test('the badge refresh throttle is persisted, not per-worker', async () => {
    const setBadge = vi.spyOn(fakeBrowser.action, 'setBadgeText');
    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'heartbeat', scheduledTime: Date.now() });
    await vi.waitFor(() => expect(setBadge).toHaveBeenCalled());

    // A brand-new worker (fresh module scope) must still honour the interval and
    // NOT refresh again a minute later.
    setBadge.mockClear();
    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'heartbeat', scheduledTime: Date.now() });
    await new Promise((r) => setTimeout(r, 20));
    expect(setBadge).not.toHaveBeenCalled();
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
    const download = vi.spyOn(fakeBrowser.downloads, 'download').mockResolvedValue(undefined);
    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'daily', scheduledTime: Date.now() });
    await new Promise((r) => setTimeout(r, 20));
    expect(download).not.toHaveBeenCalled();
  });

  test('downloads a backup on the first due daily check', async () => {
    await saveSettings({ autoExportDays: 7 });
    const download = vi.spyOn(fakeBrowser.downloads, 'download').mockResolvedValue(undefined);
    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'daily', scheduledTime: Date.now() });
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));

    const [opts] = download.mock.calls[0]!;
    expect(opts.filename).toMatch(/^tabstyr-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(opts.url).toMatch(/^data:application\/json;base64,/);
    expect(opts.saveAs).toBe(false);

    const { autoExportState } = await fakeBrowser.storage.local.get('autoExportState');
    expect((autoExportState as { lastExportAt: number }).lastExportAt).toBeGreaterThan(0);
  });

  test('does not re-download before the interval has elapsed', async () => {
    await saveSettings({ autoExportDays: 7 });
    await fakeBrowser.storage.local.set({ autoExportState: { lastExportAt: Date.now() - 2 * DAY_MS } });
    const download = vi.spyOn(fakeBrowser.downloads, 'download').mockResolvedValue(undefined);
    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'daily', scheduledTime: Date.now() });
    await new Promise((r) => setTimeout(r, 20));
    expect(download).not.toHaveBeenCalled();
  });

  test('downloads again once the interval has elapsed', async () => {
    await saveSettings({ autoExportDays: 7 });
    await fakeBrowser.storage.local.set({ autoExportState: { lastExportAt: Date.now() - 8 * DAY_MS } });
    const download = vi.spyOn(fakeBrowser.downloads, 'download').mockResolvedValue(undefined);
    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'daily', scheduledTime: Date.now() });
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  });

  test('the exported backup contains the actual stored data', async () => {
    await saveSettings({ autoExportDays: 1 });
    await repo.upsertTabMeta({ tabId: 1, key: 'k1', url: 'https://a.com', title: 'A', lastActiveAt: Date.now(), createdAt: Date.now() });
    const download = vi.spyOn(fakeBrowser.downloads, 'download').mockResolvedValue(undefined);
    background.main();
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'daily', scheduledTime: Date.now() });
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));

    const [opts] = download.mock.calls[0]!;
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

    await fakeBrowser.runtime.onMessage.trigger({ type: 'wipe-data' }, { id: fakeBrowser.runtime.id }, () => {});

    await vi.waitFor(async () => {
      expect(await repo.getAllTabMeta()).toEqual([]);
    });
  });

  test('ignores a wipe-data message from a different extension', async () => {
    await repo.upsertTabMeta({ tabId: 1, key: 'k1', url: 'https://a.com', title: 'A', lastActiveAt: Date.now(), createdAt: Date.now() });
    background.main();

    await fakeBrowser.runtime.onMessage.trigger({ type: 'wipe-data' }, { id: 'some-other-extension' }, () => {});

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

  test('activating a tab on an excluded domain records no tabMeta and starts no session', async () => {
    const start = Date.parse('2026-07-15T10:00:00Z');
    const now = vi.spyOn(Date, 'now').mockReturnValue(start);
    focusWindow(0);
    await saveSettings({ excludedDomains: ['example.com'] });

    background.main();
    const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/' });
    await fakeBrowser.tabs.onActivated.trigger({ tabId: tab.id!, windowId: tab.windowId! });

    now.mockReturnValue(start + 5 * 60_000);
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'heartbeat', scheduledTime: Date.now() });
    await new Promise((r) => setTimeout(r, 20));

    expect(await repo.getAllSessions()).toEqual([]);
    expect(await repo.getTabMeta(tab.id!)).toBeUndefined();
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

describe('background: manual pause', () => {
  test('starting paused records no tabMeta and starts no session', async () => {
    const start = Date.parse('2026-07-15T10:00:00Z');
    vi.spyOn(Date, 'now').mockReturnValue(start);
    focusWindow(0);
    await saveSettings({ trackingPaused: true });

    background.main();
    const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/' });
    await fakeBrowser.tabs.onActivated.trigger({ tabId: tab.id!, windowId: tab.windowId! });
    await new Promise((r) => setTimeout(r, 20));

    expect(await repo.getAllSessions()).toEqual([]);
    expect(await repo.getTabMeta(tab.id!)).toBeUndefined();
  });

  test('pausing mid-session closes it immediately, and unpausing resumes on the same tab', async () => {
    const start = Date.parse('2026-07-15T10:00:00Z');
    const clock = vi.spyOn(Date, 'now').mockReturnValue(start);
    focusWindow(0);

    background.main();
    const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/' });
    await fakeBrowser.tabs.onActivated.trigger({ tabId: tab.id!, windowId: tab.windowId! });
    // fake-browser has no public way to mark a plain created tab as the
    // "active" one (only tabs.duplicate() sets that internal bookkeeping, and
    // it has its own gap — the duplicated tab is never added to the tab list,
    // so it's unreachable afterward). Stub the one query shape the resume path
    // below actually uses, rather than fighting fake-browser's tab model.
    const realQuery = fakeBrowser.tabs.query.bind(fakeBrowser.tabs);
    vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation((q) =>
      q?.active && q?.lastFocusedWindow ? Promise.resolve([tab]) : realQuery(q),
    );

    clock.mockReturnValue(start + 2 * 60_000); // 2 minutes tracked before pausing
    await saveSettings({ trackingPaused: true });
    await fakeBrowser.runtime.onMessage.trigger({ type: 'settings-changed' }, { id: fakeBrowser.runtime.id }, () => {});

    await vi.waitFor(async () => {
      expect(await repo.getAllSessions()).not.toEqual([]);
    });
    const pausedSessions = await repo.getAllSessions();
    const pausedTotalMs = pausedSessions.reduce((sum, s) => sum + (s.end - s.start), 0);
    expect(pausedTotalMs).toBeGreaterThanOrEqual(115_000); // closed by the pause, not lost

    // Nothing new accrues while paused, even across a heartbeat.
    clock.mockReturnValue(start + 5 * 60_000);
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'heartbeat', scheduledTime: Date.now() });
    await new Promise((r) => setTimeout(r, 20));
    expect(await repo.getAllSessions()).toHaveLength(pausedSessions.length);

    // Unpausing while still on the same tab starts counting again immediately.
    await saveSettings({ trackingPaused: false });
    await fakeBrowser.runtime.onMessage.trigger({ type: 'settings-changed' }, { id: fakeBrowser.runtime.id }, () => {});
    clock.mockReturnValue(start + 8 * 60_000);
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'heartbeat', scheduledTime: Date.now() });

    await vi.waitFor(async () => {
      expect((await repo.getAllSessions()).length).toBeGreaterThan(pausedSessions.length);
    });
  });
});

describe('background: browser events', () => {
  const START = Date.parse('2026-07-15T10:00:00Z');
  const MIN = 60_000;

  async function trackedMs(domain?: string) {
    const sessions = await repo.getAllSessions();
    return sessions.filter((s) => !domain || s.domain === domain).reduce((sum, s) => sum + (s.end - s.start), 0);
  }

  // Focus a fresh web tab in a fresh worker, with the clock under test control.
  async function startTracking(url = 'https://example.com/') {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(START);
    focusWindow(0);
    background.main();
    const tab = await fakeBrowser.tabs.create({ url });
    await fakeBrowser.tabs.onActivated.trigger({ tabId: tab.id!, windowId: tab.windowId! });
    return { tab, clock };
  }

  async function heartbeat() {
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'heartbeat', scheduledTime: Date.now() });
  }

  // fake-browser can't mark a created tab as active, so answer the
  // "active tab in the last focused window" query directly.
  function stubActiveTab(tab: Browser.tabs.Tab) {
    const realQuery = fakeBrowser.tabs.query.bind(fakeBrowser.tabs);
    vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation((q) =>
      q?.active && q?.lastFocusedWindow ? Promise.resolve([tab]) : realQuery(q),
    );
  }

  describe('tabs.onUpdated', () => {
    test('typing a URL into the focused new-tab page starts counting', async () => {
      const { tab, clock } = await startTracking('chrome://newtab/');
      await fakeBrowser.tabs.onUpdated.trigger(tab.id!, { url: 'https://example.com/' }, { ...tab, url: 'https://example.com/', active: true });

      clock.mockReturnValue(START + 3 * MIN);
      await heartbeat();

      expect(await trackedMs('example.com')).toBe(3 * MIN);
    });

    test('a navigation in a private window records nothing', async () => {
      const { tab, clock } = await startTracking('chrome://newtab/');
      const url = 'https://example.com/';
      await fakeBrowser.tabs.onUpdated.trigger(tab.id!, { url }, { ...tab, url, active: true, incognito: true });

      clock.mockReturnValue(START + 3 * MIN);
      await heartbeat();

      expect(await repo.getAllSessions()).toEqual([]);
      expect(await repo.getTabMeta(tab.id!)).toBeUndefined();
    });

    test('a title-only update does not split the session', async () => {
      const { tab, clock } = await startTracking();
      await fakeBrowser.tabs.onUpdated.trigger(tab.id!, { title: 'New title' }, { ...tab, title: 'New title', active: true });

      clock.mockReturnValue(START + 2 * MIN);
      await heartbeat();

      expect(await repo.getAllSessions()).toHaveLength(1);
    });
  });

  test('closing the focused tab saves its time and forgets the tab', async () => {
    const { tab, clock } = await startTracking();
    clock.mockReturnValue(START + 2 * MIN);

    await fakeBrowser.tabs.onRemoved.trigger(tab.id!, { windowId: tab.windowId!, isWindowClosing: false });

    expect(await trackedMs()).toBe(2 * MIN);
    expect(await repo.getTabMeta(tab.id!)).toBeUndefined();
  });

  test('switching to another app stops counting at once', async () => {
    const { clock } = await startTracking();
    clock.mockReturnValue(START + 2 * MIN);
    await fakeBrowser.windows.onFocusChanged.trigger(-1);

    clock.mockReturnValue(START + 10 * MIN);
    await heartbeat();

    expect(await trackedMs()).toBe(2 * MIN);
  });

  describe('idle.onStateChanged', () => {
    let fireIdle: (state: string) => Promise<void>;
    beforeEach(() => {
      vi.mocked(fakeBrowser.idle.onStateChanged.addListener).mockImplementation((listener) => {
        fireIdle = listener as never;
      });
    });

    test('locking the screen stops counting', async () => {
      const { clock } = await startTracking();
      clock.mockReturnValue(START + 2 * MIN);
      await fireIdle('locked');

      clock.mockReturnValue(START + 10 * MIN);
      await heartbeat();

      expect(await trackedMs()).toBe(2 * MIN);
    });

    test('coming back from idle resumes counting on the active tab', async () => {
      const { tab, clock } = await startTracking();
      stubActiveTab(tab);
      clock.mockReturnValue(START + 2 * MIN);
      await fireIdle('idle');

      clock.mockReturnValue(START + 5 * MIN);
      await fireIdle('active');
      clock.mockReturnValue(START + 7 * MIN);
      await heartbeat();

      expect(await trackedMs()).toBe(4 * MIN);
    });
  });

  describe('SPA navigation (webNavigation)', () => {
    // fakeBrowser.reset() keeps webNavigation listeners, so workers from earlier
    // tests would still react to these events.
    beforeEach(() => {
      fakeBrowser.webNavigation.onHistoryStateUpdated.removeAllListeners();
      fakeBrowser.webNavigation.onReferenceFragmentUpdated.removeAllListeners();
    });

    async function pages() {
      return (await repo.getAllSessions()).map((s) => s.url);
    }

    test('a pushState route change splits time between the two pages', async () => {
      const { tab, clock } = await startTracking();
      clock.mockReturnValue(START + MIN);
      await fakeBrowser.webNavigation.onHistoryStateUpdated.trigger({ tabId: tab.id!, frameId: 0, url: 'https://example.com/watch' } as never);
      clock.mockReturnValue(START + 3 * MIN);
      await heartbeat();

      expect(await pages()).toEqual(['https://example.com/', 'https://example.com/watch']);
      expect(await trackedMs()).toBe(3 * MIN);
    });

    test('a route change inside an iframe is ignored', async () => {
      const { tab, clock } = await startTracking();
      clock.mockReturnValue(START + MIN);
      await fakeBrowser.webNavigation.onHistoryStateUpdated.trigger({ tabId: tab.id!, frameId: 3, url: 'https://example.com/embed' } as never);
      clock.mockReturnValue(START + 3 * MIN);
      await heartbeat();

      expect(await pages()).toEqual(['https://example.com/']);
    });

    test('a #/ hash route splits, a token fragment does not', async () => {
      const { tab, clock } = await startTracking();
      clock.mockReturnValue(START + MIN);
      await fakeBrowser.webNavigation.onReferenceFragmentUpdated.trigger({ tabId: tab.id!, frameId: 0, url: 'https://example.com/#access_token=abc' } as never);
      clock.mockReturnValue(START + 2 * MIN);
      await fakeBrowser.webNavigation.onReferenceFragmentUpdated.trigger({ tabId: tab.id!, frameId: 0, url: 'https://example.com/#/inbox' } as never);
      clock.mockReturnValue(START + 3 * MIN);
      await heartbeat();

      expect(await pages()).toEqual(['https://example.com/', 'https://example.com/#/inbox']);
    });

    test('a duplicate event for the same route adds no extra session', async () => {
      const { tab, clock } = await startTracking();
      clock.mockReturnValue(START + MIN);
      const event = { tabId: tab.id!, frameId: 0, url: 'https://example.com/watch' } as never;
      await fakeBrowser.webNavigation.onHistoryStateUpdated.trigger(event);
      await fakeBrowser.webNavigation.onHistoryStateUpdated.trigger(event);
      await fakeBrowser.tabs.onUpdated.trigger(tab.id!, { url: 'https://example.com/watch' }, { ...tab, url: 'https://example.com/watch', active: true });
      clock.mockReturnValue(START + 3 * MIN);
      await heartbeat();

      expect(await pages()).toEqual(['https://example.com/', 'https://example.com/watch']);
    });

    test('rapid route changes lose no time', async () => {
      const { tab, clock } = await startTracking();
      for (let i = 1; i <= 5; i++) {
        clock.mockReturnValue(START + MIN + i * 100);
        await fakeBrowser.webNavigation.onHistoryStateUpdated.trigger({ tabId: tab.id!, frameId: 0, url: `https://example.com/p${i}` } as never);
      }
      clock.mockReturnValue(START + 3 * MIN);
      await heartbeat();

      expect(await trackedMs()).toBe(3 * MIN);
    });

    test('a route change in a tab that is not focused is ignored', async () => {
      const { clock } = await startTracking();
      const other = await fakeBrowser.tabs.create({ url: 'https://other.com/' });
      clock.mockReturnValue(START + MIN);
      await fakeBrowser.webNavigation.onHistoryStateUpdated.trigger({ tabId: other.id!, frameId: 0, url: 'https://other.com/next' } as never);
      clock.mockReturnValue(START + 3 * MIN);
      await heartbeat();

      expect(await pages()).toEqual(['https://example.com/']);
    });
  });

  test('a replaced tab id keeps counting under the same stable key', async () => {
    let replace: (added: number, removed: number) => Promise<void> = async () => {};
    stubOnReplaced().mockImplementation((listener) => {
      replace = listener as never;
    });
    const { tab, clock } = await startTracking();
    const { key } = (await repo.getTabMeta(tab.id!))!;
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([{ ...tab, id: 999 }] as never);

    clock.mockReturnValue(START + MIN);
    await replace(999, tab.id!);
    clock.mockReturnValue(START + 3 * MIN);
    await heartbeat();

    expect(await repo.getTabMeta(tab.id!)).toBeUndefined();
    expect((await repo.getTabMeta(999))?.key).toBe(key);
    const sessions = await repo.getAllSessions();
    expect(sessions.every((s) => s.tabKey === key)).toBe(true);
    expect(await trackedMs()).toBe(3 * MIN);
  });

  test('on browser start, saved tabs are matched to the new tab ids by URL', async () => {
    await repo.upsertTabMeta({ tabId: 50, key: 'kept-key', url: 'https://example.com/', title: 'Example', lastActiveAt: 1, createdAt: 1 });
    background.main();
    const live = await fakeBrowser.tabs.create({ url: 'https://example.com/?utm=1' });

    await fakeBrowser.runtime.onStartup.trigger();

    expect(await repo.getTabMeta(50)).toBeUndefined();
    expect((await repo.getTabMeta(live.id!))?.key).toBe('kept-key');
  });

  test.each([
    ['tab-time-budget', '#focus'],
    ['tab-time-session', '#focus'],
    ['tab-time-stale', '#stale'],
    ['tab-time-storage-full', '#stale'],
  ])('clicking the %s notification opens the dashboard at %s', async (id, hash) => {
    const create = vi.spyOn(fakeBrowser.tabs, 'create');
    background.main();
    create.mockClear();

    await fakeBrowser.notifications.onClicked.trigger(id);

    expect(create).toHaveBeenCalledWith({ url: expect.stringMatching(new RegExp(`/dashboard\\.html${hash}$`)) });
  });

  describe('runtime.onMessage', () => {
    test.each([[null], ['wipe-data'], [42], [[]], [{}], [{ type: 'unknown' }], [{ type: 7 }]])(
      'ignores a malformed or unknown message %j and keeps working',
      async (message) => {
        await repo.upsertTabMeta({ tabId: 1, key: 'k1', url: 'https://a.com/', title: 'A', lastActiveAt: 1, createdAt: 1 });
        const { clock } = await startTracking();

        await expect(fakeBrowser.runtime.onMessage.trigger(message, { id: fakeBrowser.runtime.id }, () => {})).resolves.toBeDefined();
        clock.mockReturnValue(START + 2 * MIN);
        await heartbeat();

        expect(await repo.getTabMeta(1)).toBeDefined();
        expect(await trackedMs()).toBe(2 * MIN);
      },
    );

    test('settings-changed applies the new idle timeout', async () => {
      background.main();
      await saveSettings({ idleSeconds: 300 });
      await fakeBrowser.runtime.onMessage.trigger({ type: 'settings-changed' }, { id: fakeBrowser.runtime.id }, () => {});

      expect(fakeBrowser.idle.setDetectionInterval).toHaveBeenLastCalledWith(300);
    });
  });

  describe('continuous-session alert', () => {
    async function browseFor(url: string, minutes: number) {
      const { clock } = await startTracking(url);
      for (let m = 1; m <= minutes; m += 10) {
        clock.mockReturnValue(START + m * MIN);
        await heartbeat();
      }
      return Object.keys(await fakeBrowser.notifications.getAll());
    }

    test('fires once a distracting site has been in view past the threshold', async () => {
      await saveSettings({ notificationsEnabled: true, sessionAlertMinutes: 30 });
      expect(await browseFor('https://www.reddit.com/', 41)).toContain('tab-time-session');
    });

    test('does not fire for a productive site', async () => {
      await saveSettings({ notificationsEnabled: true, sessionAlertMinutes: 30 });
      expect(await browseFor('https://github.com/', 41)).not.toContain('tab-time-session');
    });

    test('does not fire when notifications are off', async () => {
      await saveSettings({ notificationsEnabled: false, sessionAlertMinutes: 30 });
      expect(await browseFor('https://www.reddit.com/', 41)).not.toContain('tab-time-session');
    });
  });

  describe('storage full', () => {
    const quota = () => new DOMException('full', 'QuotaExceededError');

    test('warns once a day and keeps the unsaved time for a later retry', async () => {
      const commit = vi.spyOn(repo, 'commitSessions').mockRejectedValue(quota());
      const { clock } = await startTracking();
      clock.mockReturnValue(START + 2 * MIN);
      await heartbeat();

      expect((await fakeBrowser.storage.local.get('storageWarning')).storageWarning).toBe(true);
      expect(Object.keys(await fakeBrowser.notifications.getAll())).toContain('tab-time-storage-full');

      await fakeBrowser.notifications.clear('tab-time-storage-full');
      clock.mockReturnValue(START + 3 * MIN);
      await heartbeat();
      expect(Object.keys(await fakeBrowser.notifications.getAll())).not.toContain('tab-time-storage-full');

      commit.mockRestore();
      clock.mockReturnValue(START + 4 * MIN);
      await heartbeat();

      expect((await fakeBrowser.storage.local.get('storageWarning')).storageWarning).toBe(false);
      expect(await trackedMs()).toBe(4 * MIN);
    });

    test('a non-quota write error does not raise the storage warning', async () => {
      vi.spyOn(repo, 'commitSessions').mockRejectedValue(new Error('disk gone'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { clock } = await startTracking();
      clock.mockReturnValue(START + 2 * MIN);
      await heartbeat();

      expect((await fakeBrowser.storage.local.get('storageWarning')).storageWarning).toBeUndefined();
    });
  });

  test('the one-time key migration stamps old keyless history, then never runs again', async () => {
    await repo.upsertTabMeta({ tabId: 7, url: 'https://a.com/', title: 'A', lastActiveAt: 1, createdAt: 1 } as never);
    await repo.commitSessions([{ tabId: 7, url: 'https://a.com/', domain: 'a.com', start: 1_000, end: 61_000, audio: false } as never], []);

    background.main();
    await vi.waitFor(async () => expect((await fakeBrowser.storage.local.get('keyMigrationV2')).keyMigrationV2).toBe(true));

    const { key } = (await repo.getTabMeta(7))!;
    expect(key).toEqual(expect.any(String));
    expect((await repo.getAllSessions())[0]!.tabKey).toBe(key);

    const upsert = vi.spyOn(repo, 'upsertTabMeta');
    background.main();
    await new Promise((r) => setTimeout(r, 20));
    expect(upsert).not.toHaveBeenCalled();
  });

  describe('worker restart', () => {
    test('a fresh worker continues the open session from storage.session', async () => {
      const { clock } = await startTracking();
      clock.mockReturnValue(START + 30_000);
      await heartbeat();

      // The old worker is gone: only the new one may handle the next alarm.
      fakeBrowser.alarms.onAlarm.removeAllListeners();
      background.main();
      clock.mockReturnValue(START + 3 * MIN);
      await heartbeat();

      expect(await trackedMs()).toBe(3 * MIN);
    });

    test('tracking still works where storage.session does not exist', async () => {
      const session = fakeBrowser.storage.session;
      (fakeBrowser.storage as { session?: unknown }).session = undefined;
      try {
        const { clock } = await startTracking();
        clock.mockReturnValue(START + 2 * MIN);
        await heartbeat();
        expect(await trackedMs()).toBe(2 * MIN);
      } finally {
        fakeBrowser.storage.session = session;
      }
    });

    test('a corrupted saved engine state does not stop tracking', async () => {
      await fakeBrowser.storage.session.set({ engineState: { focused: null, audio: 'garbage', isIdle: false } });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { clock } = await startTracking();
      clock.mockReturnValue(START + 2 * MIN);
      await heartbeat();

      expect(await trackedMs()).toBe(2 * MIN);
    });
  });
});
