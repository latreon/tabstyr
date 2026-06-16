import { computed, ref } from 'vue';
import { browser } from 'wxt/browser';
import * as repo from '@/lib/db/repo';
import { domainOf, isWebDomain } from '@/lib/domain';
import { findStale } from '@/lib/tracker/stale';
import { getSettings, saveSettings } from '@/lib/settings';
import { addDays, dateKey } from '@/lib/time';
import { buildHourlyHeatmap, type HeatmapData } from '@/lib/heatmap';
import { groupByCategory, type Category } from '@/lib/categories';
import { activeSeconds } from '@/lib/metrics';
import { summarizeProductivity } from '@/lib/productivity';
import type { DailyStat, Session, Settings, TabMeta } from '@/lib/types';

const RETENTION_MS = 90 * 86_400_000;

export interface TabRow {
  tabId: number;
  title: string;
  domain: string;
  seconds: number;
  lastActiveAt: number;
}

export function useStats() {
  const stats = ref<DailyStat[]>([]); // last 90 days
  const tabRows = ref<TabRow[]>([]);
  const staleTabs = ref<TabMeta[]>([]);
  const openTabCount = ref(0);
  const settings = ref<Settings | null>(null);
  // Seed with a real 7×24 zero grid (not []) so any pre-load template read of
  // grid[row][col] is safe before the first load() resolves.
  const heatmap = ref<HeatmapData>(buildHourlyHeatmap([]));
  const recentSessions = ref<Session[]>([]); // last 90 days, for per-domain detail
  const loading = ref(true);
  const loadError = ref(false);

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

  // Today's time grouped into categories (Work/Dev/Social/…), respecting overrides.
  const todayByCategory = computed(() => groupByCategory(todayByDomain.value, overrides.value));

  // Focus %, productive/distracting split, and the current focus streak.
  const productivity = computed(() =>
    summarizeProductivity(activeStats.value, todayKey.value, overrides.value),
  );

  async function setCategoryOverride(domain: string, category: Category): Promise<void> {
    settings.value = await saveSettings({ categoryOverrides: { ...overrides.value, [domain]: category } });
  }

  async function load(): Promise<void> {
    loading.value = true;
    loadError.value = false;
    try {
      todayKey.value = dateKey(Date.now());
      const today = todayKey.value;
      const [loadedSettings, loadedStats, metas, tabs, loadedSessions] = await Promise.all([
        getSettings(),
        repo.getStatsRange(addDays(today, -90), today),
        repo.getAllTabMeta(),
        browser.tabs.query({}),
        repo.getSessionsSince(Date.now() - RETENTION_MS),
      ]);
      settings.value = loadedSettings;
      stats.value = loadedStats;

      // Exclude the extension's own pages (dashboard) so the count and the list agree.
      const ownPrefix = browser.runtime.getURL('');
      const realTabs = tabs.filter((t) => t.id && t.url && !t.url.startsWith(ownPrefix));
      openTabCount.value = realTabs.length;

      // Heatmap & per-domain detail use FOREGROUND web sessions only (no background
      // audio, no internal pages) to match the active-time metric everywhere else.
      const foreground = loadedSessions.filter((sx) => !sx.audio && isWebDomain(sx.domain));
      recentSessions.value = foreground;
      heatmap.value = buildHourlyHeatmap(foreground);

      const liveIds = new Set(realTabs.map((t) => t.id as number));
      // Only tabs we actually interacted with (have a meta = were focused at least
      // once). Tabs merely open in the background are never listed.
      const liveMetas = metas.filter((m) => liveIds.has(m.tabId));
      staleTabs.value = findStale(liveMetas, Date.now(), loadedSettings.staleDays);

      // Per-tab time by stable key (survives tabId reuse across restarts).
      const secondsByKey = await repo.getSecondsForKeys(liveMetas.map((m) => m.key));
      tabRows.value = liveMetas
        .map((m) => ({
          tabId: m.tabId,
          title: m.title || m.url,
          domain: domainOf(m.url),
          seconds: secondsByKey.get(m.key) ?? 0,
          lastActiveAt: m.lastActiveAt,
        }))
        .sort((a, b) => b.seconds - a.seconds || b.lastActiveAt - a.lastActiveAt);
    } catch (e) {
      console.error('[dashboard] load failed', e);
      loadError.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function closeTab(tabId: number): Promise<void> {
    await browser.tabs.remove(tabId).catch(() => undefined);
    await repo.removeTabMeta(tabId);
    await load();
  }

  async function snoozeTab(tabId: number): Promise<void> {
    const m = await repo.getTabMeta(tabId);
    if (!m || !settings.value) return;
    await repo.upsertTabMeta({ ...m, snoozedUntil: Date.now() + settings.value.staleDays * 86_400_000 });
    await load();
  }

  return {
    stats, activeStats, tabRows, staleTabs, openTabCount, settings, heatmap, recentSessions,
    loading, loadError, todayKey,
    todaySeconds, todayAudioSeconds, weeklyAvgSeconds, weeklyActiveDays,
    todayByDomain, todayByCategory, productivity, overrides,
    load, closeTab, snoozeTab, setCategoryOverride,
  };
}
