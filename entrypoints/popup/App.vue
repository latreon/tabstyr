<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { getAllTabMeta, getStatsRange } from '@/lib/db/repo';
import { findStale } from '@/lib/tracker/stale';
import { getSettings } from '@/lib/settings';
import { addDays, dateKey, formatDuration } from '@/lib/time';
import { openDomain } from '@/lib/navigate';
import FaviconChip from '@/components/FaviconChip.vue';
import RingLogo from '@/components/RingLogo.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';

const todaySeconds = ref(0);
const weeklyAvgSeconds = ref(0);
const topDomains = ref<Array<{ domain: string; seconds: number }>>([]);
const tabCount = ref(0);
const staleCount = ref(0);
const loading = ref(true);
const loadError = ref(false);

const deltaPct = computed(() => {
  if (!weeklyAvgSeconds.value) return null;
  const pct = Math.round(((todaySeconds.value - weeklyAvgSeconds.value) / weeklyAvgSeconds.value) * 100);
  return pct === 0 ? null : pct;
});
const maxSeconds = computed(() => Math.max(1, ...topDomains.value.map((d) => d.seconds)));

onMounted(async () => {
  try {
    const today = dateKey(Date.now());
    const [stats, weekStats, metas, settings, tabs] = await Promise.all([
      getStatsRange(today, today),
      getStatsRange(addDays(today, -7), addDays(today, -1)),
      getAllTabMeta(),
      getSettings(),
      browser.tabs.query({}),
    ]);
    todaySeconds.value = stats.reduce((sum, s) => sum + s.seconds, 0);
    weeklyAvgSeconds.value = weekStats.reduce((sum, s) => sum + s.seconds, 0) / 7;
    const byDomain = new Map<string, number>();
    for (const s of stats) byDomain.set(s.domain, (byDomain.get(s.domain) ?? 0) + s.seconds);
    topDomains.value = [...byDomain.entries()]
      .map(([domain, seconds]) => ({ domain, seconds }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5);
    tabCount.value = tabs.length;
    const liveIds = new Set(tabs.flatMap((t) => (t.id ? [t.id] : [])));
    staleCount.value = findStale(
      metas.filter((m) => liveIds.has(m.tabId)),
      Date.now(),
      settings.staleDays,
    ).length;
  } catch (e) {
    console.error('[popup] load failed', e);
    loadError.value = true;
  } finally {
    loading.value = false;
  }
});

function openDashboard(hash = '') {
  void browser.tabs.create({ url: browser.runtime.getURL(`/dashboard.html${hash}`) });
}
</script>

<template>
  <main class="popup">
    <div class="glow" aria-hidden="true" />
    <header class="head">
      <span class="brand"><RingLogo :size="18" /> TabTime</span>
      <span class="counts">
        {{ tabCount }} tabs
        <template v-if="staleCount"> · <span class="stale-count">{{ staleCount }} stale</span></template>
      </span>
      <ThemeToggle />
    </header>

    <div v-if="loading" class="skeleton" aria-hidden="true">
      <div class="sk sk-hero" />
      <div class="sk sk-row" v-for="i in 3" :key="i" />
    </div>

    <p v-else-if="loadError" class="label error">Could not load stats — try reopening the popup.</p>

    <template v-else>
      <section class="hero">
        <span class="total gradient-text">{{ formatDuration(todaySeconds) }}</span>
        <span v-if="deltaPct !== null" class="delta" :class="deltaPct > 0 ? 'up' : 'down'">
          <span aria-hidden="true">{{ deltaPct > 0 ? '↑' : '↓' }}</span> {{ Math.abs(deltaPct) }}%
        </span>
        <div class="sub label">active today · vs weekly average</div>
      </section>

      <ul v-if="topDomains.length" class="sites" aria-label="Top sites today">
        <li v-for="d in topDomains" :key="d.domain">
          <button class="site-row" :aria-label="`Open ${d.domain} — ${formatDuration(d.seconds)} today`" @click="openDomain(d.domain)">
            <FaviconChip :domain="d.domain" />
            <span class="site-main">
              <span class="site-line">
                <span class="domain">{{ d.domain }}</span>
                <strong>{{ formatDuration(d.seconds) }}</strong>
              </span>
              <span class="track"><span class="fill" :style="{ width: `${(d.seconds / maxSeconds) * 100}%` }" /></span>
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="label empty">No activity tracked yet today.</p>

      <footer class="actions">
        <button class="cta" @click="openDashboard()">Dashboard</button>
        <button v-if="staleCount" class="stale-btn" @click="openDashboard('#stale')">{{ staleCount }} stale</button>
      </footer>
    </template>
  </main>
</template>

<style scoped>
.popup {
  position: relative;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}
.glow {
  position: absolute;
  inset: 0;
  background: var(--surface-glow);
  pointer-events: none;
}
.head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: -0.2px;
}
.counts {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-3);
}
.stale-count {
  color: var(--warn);
  font-weight: 600;
}
.hero {
  position: relative;
}
.total {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -1px;
}
.delta {
  font-size: 12px;
  font-weight: 700;
  margin-left: 8px;
}
.delta.up { color: var(--positive); }
.delta.down { color: var(--negative); }
.sub { margin-top: 2px; }
.sites {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.site-row {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.site-row:hover { background: var(--row-hover); }
.site-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.site-main { flex: 1; min-width: 0; }
.site-line {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  gap: 8px;
}
.domain {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-2);
}
.site-line strong { font-weight: 700; }
.track {
  display: block;
  height: 4px;
  border-radius: 2px;
  background: var(--bar-track);
  margin-top: 4px;
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--accent-gradient);
}
.actions {
  position: relative;
  display: flex;
  gap: 8px;
}
.cta {
  flex: 1;
  background: var(--accent-gradient);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-sm);
  padding: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.cta:hover { filter: brightness(1.05); }
.cta:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.stale-btn {
  background: var(--warn-bg);
  color: var(--warn);
  border: 1px solid var(--warn-border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.stale-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.empty, .error { position: relative; margin: 0; }
.skeleton { position: relative; display: flex; flex-direction: column; gap: 8px; }
.sk {
  border-radius: var(--radius-sm);
  background: var(--bar-track);
  animation: pulse 1.2s ease-in-out infinite;
}
.sk-hero { height: 56px; }
.sk-row { height: 34px; }
@keyframes pulse {
  50% { opacity: 0.5; }
}
</style>
