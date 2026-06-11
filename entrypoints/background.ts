import { browser } from 'wxt/browser';
import { TrackerEngine } from '@/lib/tracker/engine';
import { rollup } from '@/lib/tracker/aggregate';
import { findStale, rematchTabMeta, shouldNotify } from '@/lib/tracker/stale';
import { getSettings } from '@/lib/settings';
import * as repo from '@/lib/db/repo';
import { addDays, dateKey } from '@/lib/time';
import type { EngineState, Session } from '@/lib/types';

const RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;

export default defineBackground(() => {
  let enginePromise: Promise<TrackerEngine> | null = null;

  function getEngine(): Promise<TrackerEngine> {
    enginePromise ??= (async () => {
      const { engineState } = await browser.storage.session.get('engineState');
      const eng = new TrackerEngine((engineState as EngineState) ?? null);
      const tabs = await browser.tabs.query({});
      const liveIds = new Set(tabs.flatMap((t) => (t.id ? [t.id] : [])));
      const closed = eng.reconcile(liveIds, Date.now());
      await persist(eng, closed);
      return eng;
    })();
    return enginePromise;
  }

  async function persist(eng: TrackerEngine, closed: Session[]): Promise<void> {
    if (closed.length) {
      await repo.addSessions(closed);
      await repo.applyDailyStats(rollup(closed));
    }
    await browser.storage.session.set({ engineState: eng.getState() });
  }

  async function syncAudioSessions(eng: TrackerEngine, now: number): Promise<Session[]> {
    const settings = await getSettings();
    if (!settings.audioEnabled) return eng.syncAudio([], now);
    const audibleTabs = await browser.tabs.query({ audible: true });
    const audible = audibleTabs.flatMap((t) => (t.id && t.url ? [{ tabId: t.id, url: t.url }] : []));
    return eng.syncAudio(audible, now);
  }

  async function touchTab(tabId: number, now: number): Promise<void> {
    const tab = await browser.tabs.get(tabId).catch(() => null);
    if (!tab?.id) return;
    const existing = await repo.getTabMeta(tab.id);
    await repo.upsertTabMeta({
      tabId: tab.id,
      url: tab.url ?? '',
      title: tab.title ?? '',
      lastActiveAt: now,
      createdAt: existing?.createdAt ?? now,
      snoozedUntil: existing?.snoozedUntil,
    });
  }

  async function updateBadge(): Promise<void> {
    const [metas, settings, tabs] = await Promise.all([
      repo.getAllTabMeta(),
      getSettings(),
      browser.tabs.query({}),
    ]);
    const liveIds = new Set(tabs.flatMap((t) => (t.id ? [t.id] : [])));
    const stale = findStale(metas.filter((m) => liveIds.has(m.tabId)), Date.now(), settings.staleDays);
    await browser.action.setBadgeText({ text: stale.length ? String(stale.length) : '' });
    await browser.action.setBadgeBackgroundColor({ color: '#b0552f' });
  }

  async function runDailyMaintenance(now: number): Promise<void> {
    const today = dateKey(now);
    await repo.pruneBefore(addDays(today, -RETENTION_DAYS), now - RETENTION_DAYS * DAY_MS);

    const [settings, metas, tabs] = await Promise.all([
      getSettings(),
      repo.getAllTabMeta(),
      browser.tabs.query({}),
    ]);
    const liveIds = new Set(tabs.flatMap((t) => (t.id ? [t.id] : [])));
    const stale = findStale(metas.filter((m) => liveIds.has(m.tabId)), now, settings.staleDays);

    const { notifyState } = await browser.storage.local.get('notifyState');
    const prev = (notifyState as { lastDate: string; ids: number[] }) ?? { lastDate: '', ids: [] };
    if (shouldNotify(stale.map((m) => m.tabId), prev.ids, prev.lastDate, today)) {
      await browser.notifications.create('tab-time-stale', {
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.png'),
        title: 'Tab Time',
        message: `${stale.length} tabs untouched for ${settings.staleDays}+ days`,
      });
      await browser.storage.local.set({
        notifyState: { lastDate: today, ids: stale.map((m) => m.tabId) },
      });
    }
    await updateBadge();
  }

  // --- tracking events ---

  browser.tabs.onActivated.addListener(async ({ tabId }) => {
    const eng = await getEngine();
    const now = Date.now();
    const tab = await browser.tabs.get(tabId).catch(() => null);
    if (!tab?.url) return;
    const closed = eng.handleFocus(tabId, tab.url, now);
    closed.push(...(await syncAudioSessions(eng, now)));
    await touchTab(tabId, now);
    await persist(eng, closed);
  });

  browser.windows.onFocusChanged.addListener(async (windowId) => {
    const eng = await getEngine();
    const now = Date.now();
    if (windowId === browser.windows.WINDOW_ID_NONE) {
      await persist(eng, eng.handleBlur(now));
      return;
    }
    const [tab] = await browser.tabs.query({ active: true, windowId });
    if (!tab?.id || !tab.url) return;
    const closed = eng.handleFocus(tab.id, tab.url, now);
    closed.push(...(await syncAudioSessions(eng, now)));
    await touchTab(tab.id, now);
    await persist(eng, closed);
  });

  browser.idle.onStateChanged.addListener(async (state) => {
    const eng = await getEngine();
    const now = Date.now();
    if (state === 'active') {
      const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id || !tab.url) return;
      const closed = eng.handleFocus(tab.id, tab.url, now);
      await touchTab(tab.id, now);
      await persist(eng, closed);
    } else {
      await persist(eng, eng.handleIdle(now));
    }
  });

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url === undefined && changeInfo.audible === undefined) return;
    const eng = await getEngine();
    const now = Date.now();
    const closed: Session[] = [];
    if (changeInfo.url) {
      closed.push(...eng.handleUrlChange(tabId, changeInfo.url, now));
      if (tab.active) await touchTab(tabId, now);
    }
    if (changeInfo.audible !== undefined) {
      closed.push(...(await syncAudioSessions(eng, now)));
    }
    await persist(eng, closed);
  });

  browser.tabs.onRemoved.addListener(async (tabId) => {
    const eng = await getEngine();
    await persist(eng, eng.handleTabRemoved(tabId, Date.now()));
    await repo.removeTabMeta(tabId);
    await updateBadge();
  });

  // --- alarms ---

  browser.alarms.create('heartbeat', { periodInMinutes: 1 });
  browser.alarms.create('daily', { periodInMinutes: 60 * 24, when: Date.now() + 60_000 });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    const now = Date.now();
    if (alarm.name === 'heartbeat') {
      const eng = await getEngine();
      await persist(eng, eng.checkpoint(now));
      await updateBadge();
    } else if (alarm.name === 'daily') {
      await runDailyMaintenance(now);
    }
  });

  // --- lifecycle + UI commands ---

  browser.runtime.onStartup.addListener(async () => {
    // Tab IDs reset on browser restart: re-match saved tabMeta to live tabs by URL.
    const [metas, tabs] = await Promise.all([repo.getAllTabMeta(), browser.tabs.query({})]);
    const live = tabs.flatMap((t) => (t.id && t.url ? [{ id: t.id, url: t.url }] : []));
    await repo.replaceAllTabMeta(rematchTabMeta(metas, live));
    await updateBadge();
  });

  browser.notifications.onClicked.addListener(() => {
    void browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
  });

  // Adaptation: onMessage listener receives (message: unknown, sender: MessageSender).
  // The async variant (OnMessageListenerAsync) matches this shape and returns Promise<unknown>.
  // We narrow the message type inline instead of declaring the param as { type?: string }.
  browser.runtime.onMessage.addListener(async (message) => {
    const msg = message as { type?: string } | null | undefined;
    if (msg?.type === 'settings-changed') {
      const settings = await getSettings();
      browser.idle.setDetectionInterval(settings.idleSeconds);
      await updateBadge();
    } else if (msg?.type === 'wipe-data') {
      await repo.wipeAll();
      await browser.storage.session.remove('engineState');
      enginePromise = null;
      await updateBadge();
    }
  });

  void getSettings().then((s) => browser.idle.setDetectionInterval(s.idleSeconds));
});
