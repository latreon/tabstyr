import { computed, ref, shallowRef } from 'vue';
import { browser } from 'wxt/browser';
import * as repo from '@/lib/db/repo';
import { displayDomain, domainOf, isWebDomain } from '@/lib/domain';
import { findStale } from '@/lib/tracker/stale';
import { getSettings, saveSettings } from '@/lib/settings';
import { addDays, dateKey } from '@/lib/time';
import { buildHourlyHeatmap, type HeatmapData } from '@/lib/heatmap';
import { groupByCategory, CATEGORY_PRODUCTIVITY, type Category, type CategoryId, type CategoryRule, type CustomCategory, type Productivity } from '@/lib/categories';
import { activeSeconds } from '@/lib/metrics';
import { summarizeProductivity } from '@/lib/productivity';
import { buildComparison } from '@/lib/comparison';
import { buildInsights, type Insight } from '@/lib/insights';
import type { DailyStat, Session, Settings, TabMeta } from '@/lib/types';

const RETENTION_MS = 90 * 86_400_000;
// Rolling window shown in the hourly heatmap: today + the 6 prior days.
const HEATMAP_DAYS = 7;

export interface TabRow {
  tabId: number; // a representative open tab of this domain, for click-to-focus
  title: string;
  domain: string;
  seconds: number; // total foreground active seconds for the domain over the window
  lastActiveAt: number;
  tabCount: number; // how many open tabs currently sit on this domain
}

// A flat, presentational view of a single open/stale tab for the tabs modal.
export interface TabListItem {
  tabId: number;
  url: string;
  title: string;
  domain: string;
  lastActiveAt: number; // 0 when the tab was never focused (no meta yet)
  windowId?: number; // which browser window it lives in, for restoring on undo
}

export function useStats() {
  const stats = ref<DailyStat[]>([]); // last 90 days
  const openMetas = ref<TabMeta[]>([]); // metas of currently-open, web tabs
  const staleTabs = ref<TabMeta[]>([]);
  // Every currently-open, non-extension tab, flattened for the tabs modal. Unlike
  // openMetas this includes tabs never focused (no meta), so it matches openTabCount.
  const openTabsList = ref<TabListItem[]>([]);
  // tabId → windowId for the live tabs, so stale items (sourced from metas, which
  // don't store a window) can still be restored to their original window on undo.
  const tabWindowById = ref<Map<number, number>>(new Map());
  const openTabCount = ref(0);
  const settings = ref<Settings | null>(null);
  // Seed with a real 7×24 zero grid (not []) so any pre-load template read of
  // grid[row][col] is safe before the first load() resolves.
  const heatmap = ref<HeatmapData>(buildHourlyHeatmap([]));
  // shallowRef: this can hold tens of thousands of session rows over a 90-day
  // window. A deep `ref` would wrap every row in a reactive proxy (large heap +
  // GC churn) for no benefit — the array is only ever reassigned wholesale in
  // load() and read (never mutated in place), so shallow reactivity is sufficient
  // and reassignment still triggers dependent computeds in DomainDetail.
  const recentSessions = shallowRef<Session[]>([]); // last 90 days, for per-domain detail
  const loading = ref(true);
  const loadError = ref(false);
  // Set by the background worker when a write hit the storage quota. Surfaced as a
  // dashboard banner so a full disk isn't a silent data-loss failure.
  const storageWarning = ref(false);

  const todayKey = ref(dateKey(Date.now()));

  // The primary metric across the app is ACTIVE FOREGROUND time on real web pages:
  //   active = seconds − audioSeconds   (stored `seconds` includes background audio)
  // and we drop internal pages (chrome://, newtab, …). This keeps the headline ≤
  // wall-clock and makes every total equal the sum of the sites actually shown.
  // `audioSeconds` is preserved so audio can be surfaced separately.
  const activeStats = computed<DailyStat[]>(() =>
    stats.value
      .filter((s) => isWebDomain(s.domain))
      .map((s) => ({ ...s, seconds: activeSeconds(s) })),
  );

  const todayStats = computed(() => activeStats.value.filter((s) => s.date === todayKey.value));
  const todaySeconds = computed(() => todayStats.value.reduce((sum, s) => sum + s.seconds, 0));
  const todayAudioSeconds = computed(() => todayStats.value.reduce((sum, s) => sum + s.audioSeconds, 0));

  // Prior 7 days, averaged over days that actually have data (not a flat ÷7).
  // Drop rows with no active time (e.g. background-audio-only) so an audio-only day
  // isn't counted as an "active day" and doesn't dilute the average.
  const weekStats = computed(() => {
    const days = new Set(Array.from({ length: 7 }, (_, i) => addDays(todayKey.value, -(i + 1))));
    return activeStats.value.filter((s) => days.has(s.date) && s.seconds > 0);
  });
  const weeklyActiveDays = computed(() => new Set(weekStats.value.map((s) => s.date)).size);
  const weeklyAvgSeconds = computed(() => {
    const total = weekStats.value.reduce((sum, s) => sum + s.seconds, 0);
    return weeklyActiveDays.value ? total / weeklyActiveDays.value : 0;
  });

  const todayByDomain = computed(() => {
    const map = new Map<string, { seconds: number; audioSeconds: number }>();
    for (const s of todayStats.value) {
      const cur = map.get(s.domain) ?? { seconds: 0, audioSeconds: 0 };
      map.set(s.domain, { seconds: cur.seconds + s.seconds, audioSeconds: cur.audioSeconds + s.audioSeconds });
    }
    return [...map.entries()]
      .map(([domain, v]) => ({ domain, ...v }))
      .filter((d) => d.seconds > 0) // hide domains with no active time (audio-only)
      .sort((a, b) => b.seconds - a.seconds);
  });

  const overrides = computed(() => settings.value?.categoryOverrides ?? {});
  const categoryRules = computed<CategoryRule[]>(() => settings.value?.categoryRules ?? []);
  const customCategories = computed<CustomCategory[]>(() => settings.value?.customCategories ?? []);
  const categoryProductivity = computed<Record<Category, Productivity>>(
    () => settings.value?.categoryProductivity ?? CATEGORY_PRODUCTIVITY,
  );
  const focusTarget = computed(() => settings.value?.focusTarget ?? 50);
  const categoryBudgets = computed<Partial<Record<CategoryId, number>>>(
    () => settings.value?.categoryBudgets ?? {},
  );
  // Show the first-run intro only once settings have loaded and it isn't dismissed.
  const showOnboarding = computed(() => !!settings.value && !settings.value.onboarded);

  // Today's time grouped into categories (Work/Dev/Social/…), respecting overrides + user rules.
  const todayByCategory = computed(() =>
    groupByCategory(todayByDomain.value, overrides.value, categoryRules.value),
  );

  // Focus %, productive/distracting split, and the current focus streak.
  const productivity = computed(() =>
    summarizeProductivity(activeStats.value, todayKey.value, overrides.value, categoryRules.value, focusTarget.value, categoryProductivity.value, customCategories.value),
  );

  // Short "insight" lines derived from data already computed above (heatmap, a
  // week-over-week comparison, and the focus summary). The tile shows the top few.
  const insights = computed<Insight[]>(() => {
    const p = productivity.value;
    const judged = p.productiveSeconds + p.distractingSeconds;
    return buildInsights({
      heatmap: heatmap.value,
      week: buildComparison(activeStats.value, todayKey.value, 'week', overrides.value, categoryRules.value),
      streakDays: p.streakDays,
      todayFocusPct: judged > 0 ? p.todayFocusPct : null,
      focusTarget: p.focusTarget,
    });
  });

  // "Open tabs by time" — one row per DOMAIN that has an open tab, showing that
  // domain's total foreground active time over the window. Reads from the daily
  // stats (key-independent), so totals are stable across browser restarts and
  // aren't confused by background-audio-only time, which activeStats excludes.
  const tabRows = computed<TabRow[]>(() => {
    const totals = new Map<string, number>();
    for (const s of activeStats.value) totals.set(s.domain, (totals.get(s.domain) ?? 0) + s.seconds);

    const byDomain = new Map<string, TabMeta[]>();
    for (const m of openMetas.value) {
      const domain = domainOf(m.url);
      if (!isWebDomain(domain)) continue;
      const arr = byDomain.get(domain);
      if (arr) arr.push(m);
      else byDomain.set(domain, [m]);
    }

    return [...byDomain.entries()]
      .map(([domain, metas]) => {
        const rep = metas.reduce((a, b) => (b.lastActiveAt > a.lastActiveAt ? b : a));
        return {
          tabId: rep.tabId,
          title: rep.title || displayDomain(domain),
          domain,
          seconds: totals.get(domain) ?? 0,
          lastActiveAt: Math.max(...metas.map((m) => m.lastActiveAt)),
          tabCount: metas.length,
        };
      })
      .sort((a, b) => b.seconds - a.seconds || b.lastActiveAt - a.lastActiveAt);
  });

  // Stale tabs in the same flat shape as the open list, oldest-first (most stale
  // at the top — the ones most worth closing).
  const staleTabItems = computed<TabListItem[]>(() =>
    staleTabs.value
      .map((m) => ({
        tabId: m.tabId,
        url: m.url,
        title: m.title || displayDomain(domainOf(m.url)),
        domain: domainOf(m.url),
        lastActiveAt: m.lastActiveAt,
        windowId: tabWindowById.value.get(m.tabId),
      }))
      .sort((a, b) => a.lastActiveAt - b.lastActiveAt),
  );

  async function setCategoryOverride(domain: string, category: CategoryId): Promise<void> {
    settings.value = await saveSettings({ categoryOverrides: { ...overrides.value, [domain]: category } });
  }

  async function setCategoryProductivity(category: Category, value: Productivity): Promise<void> {
    settings.value = await saveSettings({
      categoryProductivity: { ...categoryProductivity.value, [category]: value },
    });
  }

  // Reclassify a custom category's productivity. Custom categories carry their own
  // productivity (unlike built-ins, which read the shared mapping), so this rewrites
  // the matching entry in the customCategories array.
  async function setCustomProductivity(name: CategoryId, value: Productivity): Promise<void> {
    const next = customCategories.value.map((c) => (c.name === name ? { ...c, productivity: value } : c));
    settings.value = await saveSettings({ customCategories: next });
  }

  // Set/clear a category's daily budget (minutes). null/0 removes it. Unlike the
  // productivity mapping (dashboard-only), budgets drive the background nudge, so
  // broadcast settings-changed to invalidate the background's settings cache.
  async function setCategoryBudget(category: CategoryId, minutes: number | null): Promise<void> {
    const next = { ...categoryBudgets.value };
    if (minutes && minutes > 0) next[category] = minutes;
    else delete next[category];
    settings.value = await saveSettings({ categoryBudgets: next });
    await browser.runtime.sendMessage({ type: 'settings-changed' });
  }

  async function addCategoryRule(pattern: string, category: CategoryId): Promise<void> {
    const clean = pattern.trim().toLowerCase();
    if (!clean) return;
    // Replace any existing rule with the same pattern, then append the new one.
    const next = [...categoryRules.value.filter((r) => r.pattern !== clean), { pattern: clean, category }];
    settings.value = await saveSettings({ categoryRules: next });
  }

  async function removeCategoryRule(pattern: string): Promise<void> {
    settings.value = await saveSettings({
      categoryRules: categoryRules.value.filter((r) => r.pattern !== pattern),
    });
  }

  async function dismissOnboarding(): Promise<void> {
    settings.value = await saveSettings({ onboarded: true });
  }

  // Monotonic token so overlapping load() calls (mount + post-mutation refreshes)
  // can't clobber each other: a stale earlier load that resolves last is ignored
  // because its token no longer matches the latest.
  let loadToken = 0;

  // `silent` refreshes data in place without flipping `loading` — used after
  // settings changes so the dashboard never unmounts (which would jump scroll
  // back to the top). The first load always shows the loading state.
  async function load(opts: { silent?: boolean } = {}): Promise<void> {
    const token = ++loadToken;
    if (!opts.silent) loading.value = true;
    loadError.value = false;
    // storage.local is independent of IndexedDB, so read the quota flag even if the
    // main data load below fails.
    try {
      const { storageWarning: warn } = await browser.storage.local.get('storageWarning');
      if (token === loadToken) storageWarning.value = !!warn;
    } catch {
      /* storage.local unavailable — leave the flag as-is */
    }

    // Stage 1 — headline stats, tabs, and stale list. Light queries that gate the
    // loading spinner so the dashboard paints fast.
    let stage1Ok = true;
    try {
      todayKey.value = dateKey(Date.now());
      const today = todayKey.value;
      const [loadedSettings, loadedStats, metas, tabs] = await Promise.all([
        getSettings(),
        repo.getStatsRange(addDays(today, -90), today),
        repo.getAllTabMeta(),
        browser.tabs.query({}),
      ]);
      if (token !== loadToken) return; // a newer load() superseded this one
      settings.value = loadedSettings;
      stats.value = loadedStats;

      // Exclude the extension's own pages (dashboard) so the count and the list agree.
      const ownPrefix = browser.runtime.getURL('');
      const realTabs = tabs.filter((t) => t.id && t.url && !t.url.startsWith(ownPrefix));
      openTabCount.value = realTabs.length;

      const liveIds = new Set(realTabs.map((t) => t.id as number));
      // Only tabs we actually interacted with (have a meta = were focused at least
      // once). Tabs merely open in the background are never listed.
      const liveMetas = metas.filter((m) => liveIds.has(m.tabId));
      openMetas.value = liveMetas;
      staleTabs.value = findStale(liveMetas, Date.now(), loadedSettings.staleDays);

      // Flat list of ALL open tabs (background ones included), enriched with the
      // last-active time from any meta — newest first.
      const metaById = new Map(liveMetas.map((m) => [m.tabId, m] as const));
      tabWindowById.value = new Map(
        realTabs
          .filter((tx) => tx.windowId !== undefined)
          .map((tx) => [tx.id as number, tx.windowId as number] as const),
      );
      openTabsList.value = realTabs
        .map((tx) => {
          const url = tx.url as string;
          const domain = domainOf(url);
          const meta = metaById.get(tx.id as number);
          return {
            tabId: tx.id as number,
            url,
            title: tx.title || meta?.title || displayDomain(domain),
            domain,
            lastActiveAt: meta?.lastActiveAt ?? 0,
            windowId: tx.windowId,
          };
        })
        .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    } catch (e) {
      stage1Ok = false;
      if (token === loadToken) {
        console.error('[dashboard] load failed', e);
        loadError.value = true;
      }
    } finally {
      if (token === loadToken) loading.value = false;
    }
    if (!stage1Ok) return;

    // Stage 2 — the heavy 90-day session scan + synchronous heatmap build. Kept off
    // the first-paint critical path: the heatmap ref is seeded with a zero grid, so
    // it fills in a beat after the headline renders instead of blocking it.
    try {
      const loadedSessions = await repo.getSessionsSince(Date.now() - RETENTION_MS);
      if (token !== loadToken) return;
      // FOREGROUND web sessions only (no background audio, no internal pages) to
      // match the active-time metric everywhere else.
      const foreground = loadedSessions.filter((sx) => !sx.audio && isWebDomain(sx.domain));
      recentSessions.value = foreground;
      // Heatmap covers a ROLLING last-7-days window ending right now: from midnight
      // of (today − 6 days) to the present moment. That's 7 distinct weekdays, so
      // each maps to exactly one grid row — no piling every past Friday into "Friday"
      // (which made today's row look like a full day when it's only reached ~noon).
      // Sessions straddling the window start are clipped so only the in-window slice
      // counts; today's row naturally stops at the current hour.
      const windowStart = new Date();
      windowStart.setHours(0, 0, 0, 0);
      windowStart.setDate(windowStart.getDate() - (HEATMAP_DAYS - 1));
      const startMs = windowStart.getTime();
      const windowed = foreground
        .filter((sx) => sx.end > startMs)
        .map((sx) => (sx.start < startMs ? { ...sx, start: startMs } : sx));
      heatmap.value = buildHourlyHeatmap(windowed);
    } catch (e) {
      if (token === loadToken) console.error('[dashboard] session/heatmap load failed', e);
    }
  }

  async function closeTab(tabId: number): Promise<void> {
    await browser.tabs.remove(tabId).catch(() => undefined);
    await repo.removeTabMeta(tabId).catch(() => undefined);
    // Silent: refresh data in place so the open modal stays mounted (no spinner,
    // no scroll jump) while the user keeps closing tabs.
    await load({ silent: true });
  }

  // Close several tabs at once (e.g. "Close all stale"), then refresh once.
  async function closeTabs(tabIds: number[]): Promise<void> {
    await Promise.all(tabIds.map((id) => browser.tabs.remove(id).catch(() => undefined)));
    await Promise.all(tabIds.map((id) => repo.removeTabMeta(id).catch(() => undefined)));
    await load({ silent: true });
  }

  async function snoozeTab(tabId: number): Promise<void> {
    const m = await repo.getTabMeta(tabId);
    if (!m || !settings.value) return;
    await repo.upsertTabMeta({ ...m, snoozedUntil: Date.now() + settings.value.staleDays * 86_400_000 });
    await load({ silent: true });
  }

  return {
    stats, activeStats, tabRows, staleTabs, staleTabItems, openTabsList, openTabCount, settings, heatmap, recentSessions,
    loading, loadError, storageWarning, todayKey,
    todaySeconds, todayAudioSeconds, weeklyAvgSeconds, weeklyActiveDays,
    todayByDomain, todayByCategory, productivity, insights, overrides, categoryRules, customCategories, categoryProductivity, focusTarget, categoryBudgets, showOnboarding,
    load, closeTab, closeTabs, snoozeTab, setCategoryOverride, setCategoryProductivity, setCustomProductivity, setCategoryBudget, addCategoryRule, removeCategoryRule, dismissOnboarding,
  };
}
