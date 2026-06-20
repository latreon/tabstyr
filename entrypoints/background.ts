import { browser } from 'wxt/browser';
import { TrackerEngine } from '@/lib/tracker/engine';
import { rollup } from '@/lib/tracker/aggregate';
import { findStale, rematchTabMeta, shouldNotify } from '@/lib/tracker/stale';
import { staleNotification } from '@/lib/i18n/notify';
import { getSettings } from '@/lib/settings';
import * as repo from '@/lib/db/repo';
import { addDays, dateKey } from '@/lib/time';
import { domainOf, isWebDomain } from '@/lib/domain';
import type { ClosedSession, EngineState, Session } from '@/lib/types';

// Firefox MV2 builds expose browserAction; Chromium MV3 exposes action.
const actionApi = browser.action ?? (browser as unknown as { browserAction: typeof browser.action }).browserAction;

const RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;

// storage.session is MV3-era (Chrome 102+, Firefox 115+, Safari 16.4+). Where it's
// absent (older Safari, etc.) `browser.storage.session` is undefined and a direct
// call would throw — degrade gracefully: the engine just rebuilds from tabs.query()
// via reconcile() on the next cold start instead of restoring its in-memory state.
const sessionStore = {
  async get(key: string): Promise<Record<string, unknown>> {
    try {
      return (await browser.storage.session?.get(key)) ?? {};
    } catch {
      return {};
    }
  },
  async set(items: Record<string, unknown>): Promise<void> {
    try {
      await browser.storage.session?.set(items);
    } catch {
      /* storage.session unavailable — state is recomputed on cold start */
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await browser.storage.session?.remove(key);
    } catch {
      /* storage.session unavailable */
    }
  },
};

export default defineBackground(() => {
  let enginePromise: Promise<TrackerEngine> | null = null;

  // Wrap an async event listener so a thrown error is logged, not left as an
  // unhandled rejection that silently stops tracking for this worker.
  function guard<A extends unknown[]>(fn: (...a: A) => Promise<unknown>): (...a: A) => Promise<void> {
    return async (...a: A) => {
      try {
        await fn(...a);
      } catch (e) {
        console.error('[tab-time] handler failed', e);
      }
    };
  }

  // Single-threaded JS + the ??= singleton make concurrent listener access safe;
  // interleaved awaits can at worst lose a sub-second session between events,
  // which the 1-minute heartbeat checkpoint + reconcile bounds and repairs.
  function getEngine(): Promise<TrackerEngine> {
    enginePromise ??= (async () => {
      const { engineState } = await sessionStore.get('engineState');
      const eng = new TrackerEngine((engineState as EngineState) ?? null);
      const tabs = await browser.tabs.query({});
      const liveIds = new Set(tabs.flatMap((t) => (t.id ? [t.id] : [])));
      const closed = eng.reconcile(liveIds, Date.now());
      await persist(eng, closed);
      return eng;
    })().catch((e) => {
      // A failed init must not stick as a permanently-rejected promise (??= would
      // never retry it) — clear it so the next event rebuilds the engine.
      enginePromise = null;
      throw e;
    });
    return enginePromise;
  }

  // Attach each closed session's stable tab key (from persisted tabMeta) so per-tab
  // totals survive tabId reuse across restarts. Tabs that were focused/navigated
  // always have a meta+key (see touchTab); audio-only tabs that never had a meta
  // get a throwaway key — their sessions simply won't join any visible open tab.
  async function stampKeys(closed: ClosedSession[]): Promise<Session[]> {
    const keyByTab = new Map<number, string>();
    const out: Session[] = [];
    for (const s of closed) {
      let key = keyByTab.get(s.tabId);
      if (!key) {
        const meta = await repo.getTabMeta(s.tabId);
        key = meta?.key ?? crypto.randomUUID();
        keyByTab.set(s.tabId, key);
      }
      out.push({ ...s, tabKey: key });
    }
    return out;
  }

  async function persist(eng: TrackerEngine, closed: ClosedSession[]): Promise<void> {
    if (closed.length) {
      const sessions = await stampKeys(closed);
      // Sessions + their daily rollup committed atomically (single transaction).
      await repo.commitSessions(sessions, rollup(sessions));
    }
    await sessionStore.set({ engineState: eng.getState() });
  }

  async function syncAudioSessions(eng: TrackerEngine, now: number): Promise<ClosedSession[]> {
    const settings = await getSettings();
    if (!settings.audioEnabled) return eng.syncAudio([], now);
    const audibleTabs = await browser.tabs.query({ audible: true });
    const audible = audibleTabs.flatMap((t) =>
      t.id && t.url && !t.incognito ? [{ tabId: t.id, url: t.url }] : [],
    );
    return eng.syncAudio(audible, now);
  }

  async function touchTab(
    tabId: number,
    now: number,
    prefetched?: { id?: number; url?: string; title?: string; incognito?: boolean } | null,
  ): Promise<void> {
    const tab = prefetched ?? (await browser.tabs.get(tabId).catch(() => null));
    if (!tab?.id) return;
    // Never persist anything about private windows.
    if (tab.incognito) return;
    // Only record metadata for real web pages — internal pages aren't "sites" and
    // shouldn't appear in the tab list or stale tracking.
    if (!isWebDomain(domainOf(tab.url ?? ''))) return;
    const existing = await repo.getTabMeta(tab.id);
    await repo.upsertTabMeta({
      tabId: tab.id,
      key: existing?.key ?? crypto.randomUUID(),
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
    await actionApi.setBadgeText({ text: stale.length ? String(stale.length) : '' });
    await actionApi.setBadgeBackgroundColor({ color: '#b0552f' });
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
    // browser.notifications is absent on some platforms (e.g. Safari) — skip gracefully.
    if (browser.notifications && shouldNotify(stale.map((m) => m.tabId), prev.ids, prev.lastDate, today)) {
      await browser.notifications.create('tab-time-stale', {
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.png'),
        title: 'TabStyr',
        message: staleNotification(settings.language, stale.length, settings.staleDays),
      });
      await browser.storage.local.set({
        notifyState: { lastDate: today, ids: stale.map((m) => m.tabId) },
      });
    }
    await updateBadge();
  }

  // --- tracking events ---

  browser.tabs.onActivated.addListener(guard(async ({ tabId }) => {
    const eng = await getEngine();
    const now = Date.now();
    const tab = await browser.tabs.get(tabId).catch(() => null);
    if (!tab?.url || tab.incognito) {
      await persist(eng, eng.handleBlur(now));
      return;
    }
    const closed = eng.handleFocus(tabId, tab.url, now, !!tab.audible);
    closed.push(...(await syncAudioSessions(eng, now)));
    await touchTab(tabId, now, tab);
    await persist(eng, closed);
  }));

  browser.windows.onFocusChanged.addListener(guard(async (windowId) => {
    const eng = await getEngine();
    const now = Date.now();
    if (windowId === browser.windows.WINDOW_ID_NONE) {
      await persist(eng, eng.handleBlur(now));
      return;
    }
    const [tab] = await browser.tabs.query({ active: true, windowId });
    if (!tab?.id || !tab.url || tab.incognito) {
      await persist(eng, eng.handleBlur(now));
      return;
    }
    const closed = eng.handleFocus(tab.id, tab.url, now, !!tab.audible);
    closed.push(...(await syncAudioSessions(eng, now)));
    await touchTab(tab.id, now);
    await persist(eng, closed);
  }));

  // browser.idle is unavailable on some platforms (e.g. Safari). Without it,
  // tracking simply isn't idle-paused; the MAX_SESSION_MS cap still bounds gaps.
  browser.idle?.onStateChanged?.addListener(guard(async (state) => {
    const eng = await getEngine();
    const now = Date.now();
    if (state === 'active') {
      const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id || !tab.url || tab.incognito) return;
      const closed = eng.handleFocus(tab.id, tab.url, now, !!tab.audible);
      closed.push(...(await syncAudioSessions(eng, now))); // resume audio after idle
      await touchTab(tab.id, now);
      await persist(eng, closed);
    } else if (state === 'locked') {
      // Screen locked / system asleep — definitely away; close everything (capped).
      await persist(eng, eng.handleLocked(now));
    } else {
      // No input. A focused tab playing media keeps counting; otherwise we stop.
      await persist(eng, eng.handleIdle(now));
    }
  }));

  browser.tabs.onUpdated.addListener(guard(async (tabId, changeInfo, tab) => {
    if (changeInfo.url === undefined && changeInfo.audible === undefined) return;
    if (tab.incognito) return; // never track private windows
    const eng = await getEngine();
    const now = Date.now();
    const closed: ClosedSession[] = [];
    if (changeInfo.url) {
      const focusedTabId = eng.getState().focused?.tabId;
      if (tab.active && focusedTabId !== tabId && isWebDomain(domainOf(changeInfo.url))) {
        // The active tab navigated from an untracked page (new-tab/internal/redirect)
        // to a real web page. The engine isn't tracking it yet, and no onActivated
        // will fire for an in-tab navigation — so start the session here. Without
        // this, "open browser → type a URL → read it" records zero time.
        closed.push(...eng.handleFocus(tabId, changeInfo.url, now, !!tab.audible));
      } else {
        closed.push(...eng.handleUrlChange(tabId, changeInfo.url, now));
      }
      if (tab.active) await touchTab(tabId, now, tab);
    }
    if (changeInfo.audible !== undefined) {
      if (tab.active) eng.setFocusedAudible(changeInfo.audible); // focused tab started/stopped media
      closed.push(...(await syncAudioSessions(eng, now)));
    }
    await persist(eng, closed);
  }));

  // In-page (SPA) navigation: pushState/replaceState route changes and #/ hash
  // routes that never reload the page, so `tabs.onUpdated` may not fire. We only
  // act on the focused tab's top frame and only when the normalized page actually
  // changes (pageOf strips query + non-route fragments), so this neither double-
  // counts with onUpdated (a duplicate URL no-ops) nor churns on token fragments.
  async function handleSpaNavigation(tabId: number, url: string): Promise<void> {
    const eng = await getEngine();
    const state = eng.getState();
    if (state.focused?.tabId !== tabId) return; // only the focused, tracked tab
    const now = Date.now();
    const before = state.focused.url;
    const closed = eng.handleUrlChange(tabId, url, now);
    if (!closed.length && eng.getState().focused?.url === before) return; // nothing changed
    await touchTab(tabId, now);
    await persist(eng, closed);
  }

  // webNavigation is absent on some platforms — optional-chain every hop so a
  // missing API degrades to onUpdated-only coverage instead of throwing.
  browser.webNavigation?.onHistoryStateUpdated?.addListener(
    guard(async (d: { tabId: number; frameId: number; url: string }) => {
      if (d.frameId !== 0) return; // top frame only — ignore iframe navigations
      await handleSpaNavigation(d.tabId, d.url);
    }),
  );
  browser.webNavigation?.onReferenceFragmentUpdated?.addListener(
    guard(async (d: { tabId: number; frameId: number; url: string }) => {
      if (d.frameId !== 0) return;
      await handleSpaNavigation(d.tabId, d.url);
    }),
  );

  browser.tabs.onRemoved.addListener(guard(async (tabId) => {
    const eng = await getEngine();
    await persist(eng, eng.handleTabRemoved(tabId, Date.now()));
    await repo.removeTabMeta(tabId);
    await updateBadge();
  }));

  // The browser kept a tab's content but changed its id (prerender activation,
  // discard/restore). Remap the live session and the stored tabMeta to the new
  // id so time keeps accruing and the stable per-tab key is preserved.
  // onReplaced (prerender/discard id swap) is Chromium-centric; absent on some
  // engines. Optional-chain the registration so it never throws at startup there.
  browser.tabs.onReplaced?.addListener(guard(async (addedTabId, removedTabId) => {
    const eng = await getEngine();
    eng.handleTabReplaced(removedTabId, addedTabId, Date.now());
    const meta = await repo.getTabMeta(removedTabId);
    if (meta) {
      await repo.upsertTabMeta({ ...meta, tabId: addedTabId });
      await repo.removeTabMeta(removedTabId);
    }
    await persist(eng, []);
  }));

  // --- alarms ---

  async function ensureAlarms(): Promise<void> {
    // alarms.create with an existing name REPLACES it — re-running this on every
    // worker wake would perpetually re-arm the 'daily' alarm. Create only if absent.
    if (!(await browser.alarms.get('heartbeat'))) {
      browser.alarms.create('heartbeat', { periodInMinutes: 1 });
    }
    if (!(await browser.alarms.get('daily'))) {
      browser.alarms.create('daily', { periodInMinutes: 60 * 24, when: Date.now() + 60_000 });
    }
  }
  void ensureAlarms();

  // One-time backfill so per-tab totals include history recorded before the stable
  // tab-key was introduced. Assigns each existing meta a key (if missing) and stamps
  // its same-run keyless sessions. Guarded by a flag so it runs at most once.
  async function migrateLegacySessionKeys(): Promise<void> {
    try {
      const { keyMigrationV2 } = await browser.storage.local.get('keyMigrationV2');
      if (keyMigrationV2) return;
      const metas = await repo.getAllTabMeta();
      const tabIdToKey = new Map<number, string>();
      for (const m of metas) {
        const key = m.key ?? crypto.randomUUID();
        if (!m.key) await repo.upsertTabMeta({ ...m, key });
        tabIdToKey.set(m.tabId, key);
      }
      await repo.backfillKeylessSessions(tabIdToKey);
      await browser.storage.local.set({ keyMigrationV2: true });
    } catch (e) {
      console.error('[tab-time] key migration failed', e);
    }
  }
  void migrateLegacySessionKeys();

  browser.alarms.onAlarm.addListener(guard(async (alarm) => {
    const now = Date.now();
    if (alarm.name === 'heartbeat') {
      const eng = await getEngine();
      // Refresh the focused tab's media state so an ongoing video keeps counting.
      const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab) eng.setFocusedAudible(!!tab.audible);
      await persist(eng, eng.checkpoint(now));
      await updateBadge();
    } else if (alarm.name === 'daily') {
      await runDailyMaintenance(now);
    }
  }));

  // --- lifecycle + UI commands ---

  browser.runtime.onStartup.addListener(guard(async () => {
    // Tab IDs reset on browser restart: re-match saved tabMeta to live tabs by URL.
    const [metas, tabs] = await Promise.all([repo.getAllTabMeta(), browser.tabs.query({})]);
    const live = tabs.flatMap((t) => (t.id && t.url && !t.incognito ? [{ id: t.id, url: t.url }] : []));
    await repo.replaceAllTabMeta(rematchTabMeta(metas, live));
    await updateBadge();
  }));

  browser.notifications?.onClicked?.addListener(() => {
    void browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html#stale') });
  });

  // Before the service worker unloads (idle eviction or browser close), flush the
  // open session's elapsed time so the ≤1-minute tail since the last heartbeat
  // isn't lost. Best-effort: the write may not finish if the worker is killed
  // immediately, but it's strictly better than dropping the tail every time.
  browser.runtime.onSuspend?.addListener(() => {
    if (!enginePromise) return; // engine never woke this session — nothing open
    void (async () => {
      try {
        const eng = await enginePromise!;
        await persist(eng, eng.checkpoint(Date.now()));
      } catch (e) {
        console.error('[tab-time] suspend flush failed', e);
      }
    })();
  });

  // Adaptation: onMessage listener receives (message: unknown, sender: MessageSender).
  // The async variant (OnMessageListenerAsync) matches this shape and returns Promise<unknown>.
  // We narrow the message type inline instead of declaring the param as { type?: string }.
  browser.runtime.onMessage.addListener(guard(async (message, sender) => {
    // Only act on messages from this extension's own pages — never a web page or
    // another extension (defense in depth; wipe-data is destructive).
    if ((sender as { id?: string })?.id !== browser.runtime.id) return;
    const msg = message as { type?: string } | null | undefined;
    if (msg?.type === 'settings-changed') {
      const settings = await getSettings();
      browser.idle?.setDetectionInterval?.(settings.idleSeconds);
      // Apply audio on/off immediately rather than waiting for the next heartbeat.
      const eng = await getEngine();
      await persist(eng, await syncAudioSessions(eng, Date.now()));
      await updateBadge();
    } else if (msg?.type === 'wipe-data') {
      await repo.wipeAll();
      await sessionStore.remove('engineState');
      await browser.storage.local.remove(['notifyState', 'keyMigrationV2']);
      enginePromise = null;
      await updateBadge();
    }
  }));

  void getSettings().then((s) => browser.idle?.setDetectionInterval?.(s.idleSeconds));
});
