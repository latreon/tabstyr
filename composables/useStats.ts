import { computed, ref } from 'vue';
import { browser } from 'wxt/browser';
import * as repo from '@/lib/db/repo';
import { domainOf } from '@/lib/domain';
import { findStale } from '@/lib/tracker/stale';
import { getSettings } from '@/lib/settings';
import { addDays, dateKey } from '@/lib/time';
import type { DailyStat, Settings, TabMeta } from '@/lib/types';

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
  const loading = ref(true);
  const loadError = ref(false);

  const todayKey = ref(dateKey(Date.now()));

  const todaySeconds = computed(() =>
    stats.value.filter((s) => s.date === todayKey.value).reduce((sum, s) => sum + s.seconds, 0),
  );

  const weeklyAvgSeconds = computed(() => {
    const weekDays = new Set(Array.from({ length: 7 }, (_, i) => addDays(todayKey.value, -(i + 1))));
    const total = stats.value.filter((s) => weekDays.has(s.date)).reduce((sum, s) => sum + s.seconds, 0);
    return total / 7;
  });

  const todayByDomain = computed(() => {
    const map = new Map<string, { seconds: number; audioSeconds: number }>();
    for (const s of stats.value.filter((s) => s.date === todayKey.value)) {
      const cur = map.get(s.domain) ?? { seconds: 0, audioSeconds: 0 };
      map.set(s.domain, { seconds: cur.seconds + s.seconds, audioSeconds: cur.audioSeconds + s.audioSeconds });
    }
    return [...map.entries()]
      .map(([domain, v]) => ({ domain, ...v }))
      .sort((a, b) => b.seconds - a.seconds);
  });

  async function load(): Promise<void> {
    loading.value = true;
    loadError.value = false;
    try {
      todayKey.value = dateKey(Date.now());
      const today = todayKey.value;
      const [loadedSettings, loadedStats, metas, secondsByTab, tabs] = await Promise.all([
        getSettings(),
        repo.getStatsRange(addDays(today, -90), today),
        repo.getAllTabMeta(),
        repo.getSecondsByTab(),
        browser.tabs.query({}),
      ]);
      settings.value = loadedSettings;
      stats.value = loadedStats;
      openTabCount.value = tabs.length;
      const liveIds = new Set(tabs.flatMap((t) => (t.id ? [t.id] : [])));
      const liveMetas = metas.filter((m) => liveIds.has(m.tabId));
      staleTabs.value = findStale(liveMetas, Date.now(), loadedSettings.staleDays);
      tabRows.value = liveMetas
        .map((m) => ({
          tabId: m.tabId,
          title: m.title || m.url,
          domain: domainOf(m.url),
          seconds: secondsByTab.get(m.tabId) ?? 0,
          lastActiveAt: m.lastActiveAt,
        }))
        .sort((a, b) => b.seconds - a.seconds);
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
    stats, tabRows, staleTabs, openTabCount, settings, loading, loadError,
    todaySeconds, weeklyAvgSeconds, todayByDomain,
    load, closeTab, snoozeTab,
  };
}
