import { browser } from 'wxt/browser';
import { TrackerEngine } from '@/lib/tracker/engine';
import { rollup } from '@/lib/tracker/aggregate';
import { findStale, rematchTabMeta, shouldNotify } from '@/lib/tracker/stale';
import { advanceSessionAlertState, shouldNotifySessionAlert, type SessionAlertState } from '@/lib/tracker/session-alert';
import {
  staleNotification, storageFullNotification, budgetNotification, sessionAlertNotification,
  menuExcludeTitle, menuPauseTitle, menuDashboardTitle, excludeToggleNotification, pauseToggleNotification,
  focusTimerNotification,
} from '@/lib/i18n/notify';
import { getSettings, invalidateSettings, saveSettings } from '@/lib/settings';
import { categorize, categoryProductivityOf, groupByCategory } from '@/lib/categories';
import { activeSeconds } from '@/lib/metrics';
import { exceededBudgets, shouldNotifyBudget } from '@/lib/budgets';
import * as repo from '@/lib/db/repo';
import { isQuotaError } from '@/lib/db/errors';
import { addDays, dateKey } from '@/lib/time';
import { monthKeyBefore } from '@/lib/monthly';
import { toJsonBackup } from '@/lib/export';
import { domainOf, isWebDomain, pageOf } from '@/lib/domain';
import { isExcludedDomain } from '@/lib/excluded-domains';
import { UNINSTALL_FEEDBACK_URL } from '@/lib/links';
import { recordInstallDate } from '@/lib/review-prompt';
import type { ClosedSession, EngineState, Session } from '@/lib/types';

// Firefox MV2 builds expose browserAction; Chromium MV3 exposes action.
const actionApi = browser.action ?? (browser as unknown as { browserAction: typeof browser.action }).browserAction;

const RETENTION_DAYS = 90;
// The monthly rollup archive has no other retention (unlike sessions/daily
// stats' 90-day window), so it's capped separately — 5 years of monthly-level
// history per domain is far more range than the dashboard's trend views ever
// show, while still bounding otherwise-unbounded growth for a long-term user.
const MAX_MONTHLY_RETENTION_MONTHS = 60;
const DAY_MS = 86_400_000;
// Stale-tab staleness is a days-granularity threshold, so the badge doesn't need a
// full tabMeta scan + tabs.query every heartbeat minute. Refresh it on real
// mutations (tab add/remove, settings, startup, daily) and only every Nth heartbeat.
const BADGE_HEARTBEAT_INTERVAL = 10;
// Cap stored tab titles. Titles are persisted in tabMeta and included in JSON
// exports; a page can set an arbitrarily long document.title, so bound it (the UI
// already truncates for display; this bounds storage + export). Well under the
// importer's 2048 ceiling.
const TITLE_MAX = 256;

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

  // Serialize every event handler through one promise chain. The handlers share a
  // single mutable TrackerEngine and mutate it across multiple awaits (tabs.get,
  // isInFocusedWindow, repo reads, persist). Running them concurrently let two
  // events interleave and corrupt focused/audio state or persist a stale snapshot
  // (last-writer-wins). Chaining makes each handler's read-mutate-persist atomic
  // with respect to the others; throughput is unaffected (events are sub-second).
  let queue: Promise<unknown> = Promise.resolve();

  // Heartbeat counter (per worker lifetime) — see BADGE_HEARTBEAT_INTERVAL.
  let heartbeatTicks = 0;
  // In-memory mirror of the persisted `storageWarning` flag. null = not yet read.
  // Avoids a storage.local round-trip on every successful commit.
  let storageWarned: boolean | null = null;

  // Wrap an async event listener so it runs after the previous handler finishes,
  // and so a thrown error is logged, not left as an unhandled rejection that
  // silently stops tracking for this worker.
  function guard<A extends unknown[]>(fn: (...a: A) => Promise<unknown>): (...a: A) => Promise<void> {
    return (...a: A) => {
      const run = queue
        .catch(() => {}) // a prior handler's failure must not break the chain
        .then(() => fn(...a))
        .then(
          () => {},
          (e) => {
            console.error('[tab-time] handler failed', e);
          },
        );
      queue = run;
      return run;
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
    // Persist the rebased engine state BEFORE committing the slices. The engine
    // already advanced each open session's `start` when it produced `closed`, so
    // the state is consistent with those slices being saved. The two writes can't
    // be atomic; ordering state-first means that if the MV3 worker is evicted
    // between them, the next cold start resumes from the new `start` and at worst
    // loses one ≤1-minute slice. Committing first instead would let reconcile
    // re-emit an already-saved slice from the stale `start` — double-counting time.
    await sessionStore.set({ engineState: eng.getState() });
    if (closed.length) {
      const sessions = await stampKeys(closed);
      // Sessions + their daily rollup committed atomically (single transaction).
      await commitWithRecovery(sessions, rollup(sessions));
    }
  }

  // Commit sessions, recovering from a full disk instead of silently dropping
  // data. On QuotaExceededError: reclaim space by pruning past-retention rows and
  // retry once; if it still fails, warn the user (throttled) and leave a flag the
  // dashboard surfaces. Non-quota errors propagate to the guard() logger unchanged.
  async function commitWithRecovery(sessions: Session[], deltas: ReturnType<typeof rollup>): Promise<void> {
    try {
      await repo.commitSessions(sessions, deltas);
      await clearStorageWarning();
    } catch (e) {
      if (!isQuotaError(e)) throw e;
      const now = Date.now();
      try {
        await repo.pruneBefore(addDays(dateKey(now), -RETENTION_DAYS), now - RETENTION_DAYS * DAY_MS, monthKeyBefore(now, MAX_MONTHLY_RETENTION_MONTHS));
        await repo.commitSessions(sessions, deltas);
        await clearStorageWarning();
        return;
      } catch (retryErr) {
        if (isQuotaError(retryErr)) await warnStorageFull();
        throw retryErr;
      }
    }
  }

  // Persistent flag + one notification per day so a full disk is visible to the
  // user (notification + dashboard banner) without spamming on every write.
  async function warnStorageFull(): Promise<void> {
    try {
      const today = dateKey(Date.now());
      const { storageWarnDate } = await browser.storage.local.get('storageWarnDate');
      await browser.storage.local.set({ storageWarning: true });
      storageWarned = true;
      if (storageWarnDate === today) return; // already notified today
      await browser.storage.local.set({ storageWarnDate: today });
      if (browser.notifications) {
        const settings = await getSettings();
        await browser.notifications.create('tab-time-storage-full', {
          type: 'basic',
          iconUrl: browser.runtime.getURL('/icon/128.png'),
          title: 'TabStyr',
          message: storageFullNotification(settings.language),
        });
      }
    } catch {
      /* storage.local itself may be full — nothing more we can do */
    }
  }

  async function clearStorageWarning(): Promise<void> {
    try {
      // Read the persisted flag once per worker lifetime, then track it in memory —
      // the overwhelmingly common case (flag already false) does zero storage I/O.
      if (storageWarned === null) {
        const { storageWarning } = await browser.storage.local.get('storageWarning');
        storageWarned = !!storageWarning;
      }
      if (storageWarned) {
        await browser.storage.local.set({ storageWarning: false });
        storageWarned = false;
      }
    } catch {
      /* ignore */
    }
  }

  async function syncAudioSessions(eng: TrackerEngine, now: number): Promise<ClosedSession[]> {
    const settings = await getSettings();
    if (!settings.audioEnabled || settings.trackingPaused) return eng.syncAudio([], now);
    const audibleTabs = await browser.tabs.query({ audible: true });
    const audible = audibleTabs.flatMap((t) =>
      t.id && t.url && !t.incognito && !isExcludedDomain(domainOf(t.url), settings.excludedDomains)
        ? [{ tabId: t.id, url: t.url }]
        : [],
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
    const domain = domainOf(tab.url ?? '');
    // Only record metadata for real web pages — internal pages aren't "sites" and
    // shouldn't appear in the tab list or stale tracking. Same for a domain the
    // user excluded: it must be as invisible as an internal page.
    if (!isWebDomain(domain)) return;
    const settings = await getSettings();
    if (settings.trackingPaused || isExcludedDomain(domain, settings.excludedDomains)) return;
    const existing = await repo.getTabMeta(tab.id);
    await repo.upsertTabMeta({
      tabId: tab.id,
      key: existing?.key ?? crypto.randomUUID(),
      // Normalize: strip query + non-route fragments so tokens/PII never reach
      // tabMeta (which is included in JSON exports). pageOf keeps scheme+host+path
      // (+ #/ SPA route) — enough to rematch and display.
      url: pageOf(tab.url ?? ''),
      title: (tab.title ?? '').slice(0, TITLE_MAX),
      lastActiveAt: now,
      createdAt: existing?.createdAt ?? now,
      snoozedUntil: existing?.snoozedUntil,
    });
  }

  // True only when `windowId` is the browser's currently focused window. `tab.active`
  // is per-window (every window has one active tab), so without this a background
  // window's active tab could steal focus/audio tracking on URL/audio updates.
  // Platforms without the windows API degrade open (treat as focused) so tracking
  // still works there.
  async function isInFocusedWindow(windowId?: number): Promise<boolean> {
    if (windowId === undefined) return false;
    if (!browser.windows?.getLastFocused) return true;
    const win = await browser.windows.getLastFocused().catch(() => null);
    return !!win && win.focused === true && win.id === windowId;
  }

  async function updateBadge(): Promise<void> {
    const [metas, settings, tabs] = await Promise.all([
      repo.getAllTabMeta(),
      getSettings(),
      browser.tabs.query({}),
    ]);
    const liveIds = new Set(tabs.flatMap((t) => (t.id ? [t.id] : [])));
    const stale = findStale(metas.filter((m) => liveIds.has(m.tabId)), Date.now(), settings.staleDays);
    // Paused overrides the stale count — it's the more important thing for the
    // user to notice at a glance, and this is the only always-visible signal
    // that nothing is being tracked right now.
    if (settings.trackingPaused) {
      await actionApi.setBadgeText({ text: '❚❚' });
      await actionApi.setBadgeBackgroundColor({ color: '#6b7280' });
      return;
    }
    await actionApi.setBadgeText({ text: stale.length ? String(stale.length) : '' });
    await actionApi.setBadgeBackgroundColor({ color: '#b0552f' });
  }

  // Per-category daily budget nudge. Sums today's active time per category and, if a
  // budget is crossed, fires at most ONE gentle notification per day (same throttle
  // shape as stale nudges). Analytics only — it never blocks a site. Cheap enough to
  // run on the badge cadence (every Nth heartbeat), and a no-op when no budgets are set.
  async function checkBudgets(now: number): Promise<void> {
    const settings = await getSettings();
    if (!settings.notificationsEnabled || !browser.notifications) return;
    const budgets = settings.categoryBudgets;
    if (!budgets || Object.keys(budgets).length === 0) return;
    const today = dateKey(now);
    const stats = await repo.getStatsRange(today, today);
    // Feed ACTIVE seconds (audio excluded here — the single subtraction point) so
    // the budget helpers receive the same active-only shape the dashboard uses.
    const domains = stats
      .filter((s) => isWebDomain(s.domain))
      .map((s) => ({ domain: s.domain, seconds: activeSeconds(s), audioSeconds: 0 }));
    const slices = groupByCategory(domains, settings.categoryOverrides, settings.categoryRules);
    const exceeded = exceededBudgets(slices, budgets);
    if (!exceeded.length) return;
    const { budgetNotifyState } = await browser.storage.local.get('budgetNotifyState');
    const prev = (budgetNotifyState as { lastDate: string }) ?? { lastDate: '' };
    if (!shouldNotifyBudget(exceeded, prev.lastDate, today)) return;
    // One nudge per day — name the first over-budget category (usually the only one).
    await browser.notifications.create('tab-time-budget', {
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title: 'TabStyr',
      message: budgetNotification(settings.language, exceeded[0]),
    });
    await browser.storage.local.set({ budgetNotifyState: { lastDate: today, ids: exceeded } });
  }

  // Continuous-session nudge: fires (at most once per uninterrupted visit) once the
  // currently-focused domain — if classified 'distracting' — has been continuously
  // in view for `sessionAlertMinutes`. Runs every heartbeat (not the coarser badge
  // cadence) so it fires promptly; the work itself is cheap (one settings read, one
  // categorize() call, one storage.local round-trip) and a no-op once the day's
  // settings are cached.
  async function checkSessionAlert(eng: TrackerEngine, now: number): Promise<void> {
    const settings = await getSettings();
    if (!settings.notificationsEnabled || !browser.notifications || settings.sessionAlertMinutes <= 0) return;
    const focused = eng.getState().focused;
    const domain = focused && isWebDomain(focused.domain) ? focused.domain : null;
    const { sessionAlertState } = await browser.storage.local.get('sessionAlertState');
    const prev = (sessionAlertState as SessionAlertState | undefined) ?? null;
    const state = advanceSessionAlertState(domain, prev, now);
    const category = domain ? categorize(domain, settings.categoryOverrides, settings.categoryRules) : null;
    const isDistracting = !!category && categoryProductivityOf(category, settings.categoryProductivity, settings.customCategories) === 'distracting';
    const fire = shouldNotifySessionAlert(state, isDistracting, settings.sessionAlertMinutes, now);
    if (fire) {
      await browser.notifications.create('tab-time-session', {
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.png'),
        title: 'TabStyr',
        message: sessionAlertNotification(settings.language, domain!, settings.sessionAlertMinutes),
      });
    }
    await browser.storage.local.set({ sessionAlertState: fire ? { ...state, notified: true } : state });
  }

  // Fires when a popup-started focus timer's one-shot alarm goes off (see the
  // 'focus-timer' alarm branch below). The popup itself may be long closed by
  // then — alarms are extension-global, not tied to the context that created
  // them — so completion always has to be handled here, not in the popup.
  async function completeFocusTimer(): Promise<void> {
    const { focusTimer } = await browser.storage.local.get('focusTimer');
    await browser.storage.local.remove('focusTimer');
    const settings = await getSettings();
    if (!settings.notificationsEnabled || !browser.notifications) return;
    const durationMin = (focusTimer as { durationMin?: number } | undefined)?.durationMin ?? 0;
    await browser.notifications.create('tab-time-focus-timer', {
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title: 'TabStyr',
      message: focusTimerNotification(settings.language, durationMin),
    });
  }

  // Optional (off by default) scheduled backup: saves a JSON file to the
  // browser's normal downloads location on the same cadence as the manual
  // "Export JSON" button produces, via the `downloads` API since the service
  // worker has no page/DOM to drive a click-triggered <a download> like
  // lib/export.ts's downloadFile does. Absent on platforms without `downloads`
  // (degrades to a no-op, same as idle/notifications elsewhere in this file).
  async function runAutoExportIfDue(now: number): Promise<void> {
    if (!browser.downloads) return;
    const settings = await getSettings();
    if (settings.autoExportDays <= 0) return;
    const { autoExportState } = await browser.storage.local.get('autoExportState');
    const lastExportAt = (autoExportState as { lastExportAt?: number } | undefined)?.lastExportAt ?? 0;
    if (now - lastExportAt < settings.autoExportDays * DAY_MS) return;
    try {
      const [dailyStats, monthlyStats, sessions, tabMeta] = await Promise.all([
        repo.getAllDailyStats(),
        repo.getAllMonthlyStats(),
        repo.getAllSessions(),
        repo.getAllTabMeta(),
      ]);
      const json = toJsonBackup({ dailyStats, monthlyStats, sessions, tabMeta, settings }, now);
      // URL.createObjectURL doesn't exist in an MV3 service worker (confirmed:
      // it's simply absent, not just quota-limited) — a data: URL is the one
      // reliable way to hand file content to downloads.download() from here.
      // btoa() only accepts Latin1, so encode via TextEncoder first — a naive
      // btoa(json) would throw/corrupt on any non-Latin1 character (accents,
      // CJK, emoji — all realistic in a page title in the backup).
      const bytes = new TextEncoder().encode(json);
      let binary = '';
      for (const b of bytes) binary += String.fromCharCode(b);
      const url = `data:application/json;base64,${btoa(binary)}`;
      await browser.downloads.download({ url, filename: `tabstyr-backup-${dateKey(now)}.json`, saveAs: false });
      await browser.storage.local.set({ autoExportState: { lastExportAt: now } });
    } catch (e) {
      console.error('[tab-time] auto-export failed', e);
    }
  }

  async function runDailyMaintenance(now: number): Promise<void> {
    const today = dateKey(now);
    // Before pruning — an export that's about to become due should still see
    // today's data; pruning only ever drops rows already past the 90-day window.
    await runAutoExportIfDue(now);
    await repo.pruneBefore(addDays(today, -RETENTION_DAYS), now - RETENTION_DAYS * DAY_MS, monthKeyBefore(now, MAX_MONTHLY_RETENTION_MONTHS));

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
    // The reminder is opt-out via settings.notificationsEnabled.
    if (settings.notificationsEnabled && browser.notifications && shouldNotify(stale.map((m) => m.tabId), prev.ids, prev.lastDate, today)) {
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
    // Activation in a background window must not steal focus from the focused
    // window. Record the tab's metadata but leave the focused session intact.
    if (!(await isInFocusedWindow(tab.windowId))) {
      await touchTab(tabId, now, tab);
      await persist(eng, []);
      return;
    }
    const settings = await getSettings();
    const excluded = settings.trackingPaused || isExcludedDomain(domainOf(tab.url), settings.excludedDomains);
    const closed = eng.handleFocus(tabId, tab.url, now, !!tab.audible, excluded);
    closed.push(...(await syncAudioSessions(eng, now)));
    await touchTab(tabId, now, tab);
    await persist(eng, closed);
  }));

  browser.windows.onFocusChanged.addListener(guard(async (windowId) => {
    const eng = await getEngine();
    const now = Date.now();
    if (windowId === browser.windows.WINDOW_ID_NONE) {
      // Browser lost OS focus (user alt-tabbed to another app). Close the focused
      // session, but re-sync audio so a tab still playing media keeps counting as a
      // background-audio session — matching every other focus path. Without this,
      // audio time is lost until the browser regains focus.
      const closed = eng.handleBlur(now);
      closed.push(...(await syncAudioSessions(eng, now)));
      await persist(eng, closed);
      return;
    }
    const [tab] = await browser.tabs.query({ active: true, windowId });
    if (!tab?.id || !tab.url || tab.incognito) {
      const closed = eng.handleBlur(now);
      closed.push(...(await syncAudioSessions(eng, now)));
      await persist(eng, closed);
      return;
    }
    const settings = await getSettings();
    const excluded = settings.trackingPaused || isExcludedDomain(domainOf(tab.url), settings.excludedDomains);
    const closed = eng.handleFocus(tab.id, tab.url, now, !!tab.audible, excluded);
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
      const settings = await getSettings();
      const excluded = settings.trackingPaused || isExcludedDomain(domainOf(tab.url), settings.excludedDomains);
      const closed = eng.handleFocus(tab.id, tab.url, now, !!tab.audible, excluded);
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
      const settings = await getSettings();
      const excluded = settings.trackingPaused || isExcludedDomain(domainOf(changeInfo.url), settings.excludedDomains);
      const focusedTabId = eng.getState().focused?.tabId;
      // `tab.active` alone is per-window — require the genuinely focused window so
      // a background window's active tab can't hijack the focused session.
      const inFocusedWin = !!tab.active && (await isInFocusedWindow(tab.windowId));
      if (inFocusedWin && focusedTabId !== tabId && isWebDomain(domainOf(changeInfo.url))) {
        // The active tab navigated from an untracked page (new-tab/internal/redirect)
        // to a real web page. The engine isn't tracking it yet, and no onActivated
        // will fire for an in-tab navigation — so start the session here. Without
        // this, "open browser → type a URL → read it" records zero time.
        closed.push(...eng.handleFocus(tabId, changeInfo.url, now, !!tab.audible, excluded));
      } else {
        closed.push(...eng.handleUrlChange(tabId, changeInfo.url, now, excluded));
      }
      if (tab.active) await touchTab(tabId, now, tab);
    }
    if (changeInfo.audible !== undefined) {
      // Only the focused window's active tab is the "focused media" tab.
      if (tab.active && (await isInFocusedWindow(tab.windowId))) eng.setFocusedAudible(changeInfo.audible);
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
      // Every heartbeat, not the coarser badge cadence — a continuous-session nudge
      // needs to fire promptly once the threshold is crossed, not up to ~10 min late.
      await checkSessionAlert(eng, now);
      // Badge is days-granularity — refresh periodically, not every minute. The
      // budget check rides the same cadence (cheap; no-op when no budgets set).
      if (++heartbeatTicks % BADGE_HEARTBEAT_INTERVAL === 0) {
        await updateBadge();
        await checkBudgets(now);
      }
    } else if (alarm.name === 'daily') {
      await runDailyMaintenance(now);
    } else if (alarm.name === 'focus-timer') {
      await completeFocusTimer();
    }
  }));

  // --- lifecycle + UI commands ---

  // First install: open the dashboard so the onboarding intro is actually seen.
  // Without this a new user only sees the toolbar popup and the onboarding card
  // (which lives on the dashboard) would never surface. Only on 'install', never
  // on 'update'/'browser_update', so upgrades don't reopen a tab each time.
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      void browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
      void recordInstallDate(Date.now());
      // A first-time install has nothing to compare against — seed the "seen"
      // version now so the popup's What's New banner (gated on a version
      // mismatch) never shows to a user who just installed. Left untouched on
      // 'update': the popup detects the mismatch against the new manifest
      // version, shows the banner once, and updates this itself.
      void browser.storage.local.set({ whatsNewVersion: browser.runtime.getManifest().version });
    }
  });

  // Opened in a browser tab right before the extension is removed — the only
  // way to learn why someone left. Re-set on every worker wake (cheap, no
  // network call) rather than gating on 'install' so an update never leaves
  // it unset for a user who installed before this shipped.
  void browser.runtime.setUninstallURL?.(UNINSTALL_FEEDBACK_URL);

  browser.runtime.onStartup.addListener(guard(async () => {
    // Tab IDs reset on browser restart: re-match saved tabMeta to live tabs by URL.
    const [metas, tabs] = await Promise.all([repo.getAllTabMeta(), browser.tabs.query({})]);
    // Normalize the live URL the same way touchTab stores it, so the exact-URL
    // match still hits (stored meta.url is now pageOf-normalized).
    const live = tabs.flatMap((t) => (t.id && t.url && !t.incognito ? [{ id: t.id, url: pageOf(t.url) }] : []));
    await repo.replaceAllTabMeta(rematchTabMeta(metas, live));
    await updateBadge();
  }));

  browser.notifications?.onClicked?.addListener((notificationId) => {
    // The budget nudge, the continuous-session nudge, and the focus-timer
    // completion all open the dashboard to the focus section; stale/other
    // open the stale-tab manager (the historical default).
    const hash = notificationId === 'tab-time-budget' || notificationId === 'tab-time-session' || notificationId === 'tab-time-focus-timer' ? '#focus' : '#stale';
    void browser.tabs.create({ url: browser.runtime.getURL(`/dashboard.html${hash}`) });
  });

  // Before the service worker unloads (idle eviction or browser close), flush the
  // open session's elapsed time so the ≤1-minute tail since the last heartbeat
  // isn't lost. Best-effort: the write may not finish if the worker is killed
  // immediately, but it's strictly better than dropping the tail every time.
  browser.runtime.onSuspend?.addListener(() => {
    if (!enginePromise) return; // engine never woke this session — nothing open
    // Chain after any in-flight handler so the flush sees committed state, not a
    // half-applied mutation (same queue the guarded handlers use).
    queue = queue
      .catch(() => {})
      .then(async () => {
        const eng = await enginePromise!;
        await persist(eng, eng.checkpoint(Date.now()));
      })
      .catch((e) => {
        console.error('[tab-time] suspend flush failed', e);
      });
  });

  // Shared by the onMessage 'settings-changed' handler AND the command/context-menu
  // pause toggle (which mutate settings directly and need the exact same
  // immediate-effect logic, not just a cache invalidation).
  async function applySettingsChanged(): Promise<void> {
    invalidateSettings(); // the dashboard just wrote new settings — drop stale cache
    const settings = await getSettings();
    browser.idle?.setDetectionInterval?.(settings.idleSeconds);
    const eng = await getEngine();
    const now = Date.now();
    let closed: ClosedSession[] = [];
    if (settings.trackingPaused) {
      // Stop counting the instant the user pauses, rather than waiting for a
      // tab switch or the next heartbeat to notice.
      closed = eng.handleBlur(now);
    } else {
      // Resuming: re-focus whatever tab is actually active right now so
      // un-pausing while staying on the same tab starts counting immediately
      // instead of waiting for the next tab switch. A no-op if the engine was
      // already tracking this exact tab+page (handleFocus's same-tab guard).
      const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab?.id && tab.url && !tab.incognito) {
        const excluded = isExcludedDomain(domainOf(tab.url), settings.excludedDomains);
        closed = eng.handleFocus(tab.id, tab.url, now, !!tab.audible, excluded);
        await touchTab(tab.id, now, tab);
      }
    }
    // Apply audio on/off immediately rather than waiting for the next heartbeat.
    closed.push(...(await syncAudioSessions(eng, now)));
    await persist(eng, closed);
    await updateBadge();
  }

  // Adaptation: onMessage listener receives (message: unknown, sender: MessageSender).
  // The async variant (OnMessageListenerAsync) matches this shape and returns Promise<unknown>.
  // We narrow the message type inline instead of declaring the param as { type?: string }.
  browser.runtime.onMessage.addListener(guard(async (message, sender) => {
    // Only act on messages from this extension's own pages — never a web page or
    // another extension (defense in depth; wipe-data is destructive).
    if ((sender as { id?: string })?.id !== browser.runtime.id) return;
    const msg = message as { type?: string } | null | undefined;
    if (msg?.type === 'settings-changed') {
      await applySettingsChanged();
    } else if (msg?.type === 'wipe-data') {
      await repo.wipeAll();
      await sessionStore.remove('engineState');
      await browser.storage.local.remove(['notifyState', 'keyMigrationV2', 'budgetNotifyState', 'sessionAlertState']);
      enginePromise = null;
      await updateBadge();
    }
  }));

  void getSettings().then((s) => browser.idle?.setDetectionInterval?.(s.idleSeconds));

  // --- keyboard shortcuts + context menu ---

  const MENU_EXCLUDE = 'tabstyr-exclude-site';
  const MENU_PAUSE = 'tabstyr-toggle-pause';
  const MENU_DASHBOARD = 'tabstyr-open-dashboard';

  // Focus an already-open dashboard tab instead of piling up duplicates when the
  // shortcut or menu item is used more than once.
  async function openOrFocusDashboard(hash = ''): Promise<void> {
    const prefix = browser.runtime.getURL('/dashboard.html');
    const tabs = await browser.tabs.query({});
    const existing = tabs.find((t) => t.url?.startsWith(prefix));
    if (existing?.id) {
      await browser.tabs.update(existing.id, { active: true, url: `${prefix}${hash}` }).catch(() => {});
      if (existing.windowId !== undefined) await browser.windows.update(existing.windowId, { focused: true }).catch(() => {});
    } else {
      await browser.tabs.create({ url: `${prefix}${hash}` });
    }
  }

  // Shared by the keyboard shortcut and the context-menu item: flip the pause
  // setting, apply it immediately (same path settings-changed uses), and confirm
  // with a notification since neither entry point has any other visible feedback.
  async function togglePauseFromShortcut(): Promise<void> {
    const settings = await getSettings();
    const next = !settings.trackingPaused;
    await saveSettings({ trackingPaused: next });
    await applySettingsChanged();
    if (browser.notifications) {
      await browser.notifications.create('tabstyr-pause-toggled', {
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.png'),
        title: 'TabStyr',
        message: pauseToggleNotification(settings.language, next),
      });
    }
  }

  // Shared by the context-menu item: exclude/un-exclude whichever domain the
  // click applies to (the right-clicked page, or the active tab for the
  // toolbar-icon menu), confirmed with a notification for the same reason as above.
  async function toggleExcludeFromMenu(domain: string): Promise<void> {
    const settings = await getSettings();
    const nowExcluded = !isExcludedDomain(domain, settings.excludedDomains);
    const next = nowExcluded
      ? [...settings.excludedDomains, domain]
      : settings.excludedDomains.filter((d) => d !== domain);
    await saveSettings({ excludedDomains: next });
    await applySettingsChanged(); // stops/lets the current session react immediately
    if (browser.notifications) {
      await browser.notifications.create('tabstyr-exclude-toggled', {
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.png'),
        title: 'TabStyr',
        message: excludeToggleNotification(settings.language, domain, nowExcluded),
      });
    }
  }

  browser.commands?.onCommand?.addListener(guard(async (command) => {
    if (command === 'open-dashboard') {
      await openOrFocusDashboard();
    } else if (command === 'toggle-pause') {
      await togglePauseFromShortcut();
    }
  }));

  // (Re-)register every wake — contextMenus.create with a duplicate id throws,
  // so clear first. Titles are seeded once here and kept live via onShown below.
  async function setupContextMenus(): Promise<void> {
    if (!browser.contextMenus) return;
    await browser.contextMenus.removeAll();
    const settings = await getSettings();
    browser.contextMenus.create({
      id: MENU_EXCLUDE,
      title: menuExcludeTitle(settings.language, '…', false),
      contexts: ['page', 'action'],
    });
    browser.contextMenus.create({
      id: MENU_PAUSE,
      title: menuPauseTitle(settings.language, settings.trackingPaused),
      contexts: ['action'],
    });
    browser.contextMenus.create({
      id: MENU_DASHBOARD,
      title: menuDashboardTitle(settings.language),
      contexts: ['action'],
    });
  }
  void setupContextMenus();

  // onShown/refresh are Chromium-only extensions to contextMenus, missing (or
  // untyped) in the webextension-polyfill types WXT ships and absent on
  // Firefox/Safari at runtime — narrow-cast once here rather than fighting the
  // type at every call.
  const chromiumMenus = browser.contextMenus as
    | (typeof browser.contextMenus & {
        onShown?: { addListener: (cb: (info: { menuIds: Array<string | number> }, tab?: { url?: string }) => void) => void };
        refresh?: () => void;
      })
    | undefined;

  // Keep the exclude/pause titles reflecting the CURRENT tab + state right
  // before the menu is shown. Chromium-only API — Firefox/Safari just keep
  // whatever title setupContextMenus last set (still correct, just not live).
  chromiumMenus?.onShown?.addListener(guard(async (_info, tab) => {
    const settings = await getSettings();
    const updates: Promise<unknown>[] = [
      browser.contextMenus!.update(MENU_PAUSE, { title: menuPauseTitle(settings.language, settings.trackingPaused) }).catch(() => {}),
    ];
    if (tab?.url) {
      const domain = domainOf(tab.url);
      if (isWebDomain(domain)) {
        const excluded = isExcludedDomain(domain, settings.excludedDomains);
        updates.push(
          browser.contextMenus!.update(MENU_EXCLUDE, {
            title: menuExcludeTitle(settings.language, domain, excluded),
            visible: true,
          }).catch(() => {}),
        );
      } else {
        // Internal page (chrome://, newtab, …) — nothing meaningful to exclude.
        updates.push(browser.contextMenus!.update(MENU_EXCLUDE, { visible: false }).catch(() => {}));
      }
    }
    await Promise.all(updates);
    chromiumMenus?.refresh?.();
  }));

  browser.contextMenus?.onClicked?.addListener(guard(async (info, tab) => {
    if (info.menuItemId === MENU_DASHBOARD) {
      await openOrFocusDashboard();
    } else if (info.menuItemId === MENU_PAUSE) {
      await togglePauseFromShortcut();
    } else if (info.menuItemId === MENU_EXCLUDE) {
      const url = info.pageUrl ?? tab?.url;
      if (!url) return;
      const domain = domainOf(url);
      if (isWebDomain(domain)) await toggleExcludeFromMenu(domain);
    }
  }));
});
