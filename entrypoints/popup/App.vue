<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { getAllTabMeta, getStatsRange } from '@/lib/db/repo';
import { findStale } from '@/lib/tracker/stale';
import { getSettings } from '@/lib/settings';
import { dateKey, formatDuration } from '@/lib/time';

const todaySeconds = ref(0);
const topDomains = ref<Array<{ domain: string; seconds: number }>>([]);
const staleCount = ref(0);
const loadError = ref(false);

onMounted(async () => {
  try {
    const today = dateKey(Date.now());
    const [stats, metas, settings, tabs] = await Promise.all([
      getStatsRange(today, today),
      getAllTabMeta(),
      getSettings(),
      browser.tabs.query({}),
    ]);
    todaySeconds.value = stats.reduce((sum, s) => sum + s.seconds, 0);
    topDomains.value = [...stats].sort((a, b) => b.seconds - a.seconds).slice(0, 3);
    const liveIds = new Set(tabs.flatMap((t) => (t.id ? [t.id] : [])));
    staleCount.value = findStale(
      metas.filter((m) => liveIds.has(m.tabId)),
      Date.now(),
      settings.staleDays,
    ).length;
  } catch (e) {
    console.error('[popup] load failed', e);
    loadError.value = true;
  }
});

function openDashboard() {
  void browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
}
</script>

<template>
  <main class="popup">
    <section class="hero">
      <span class="label">Today</span>
      <span class="value">{{ formatDuration(todaySeconds) }}</span>
    </section>
    <p v-if="loadError" class="empty">Could not load stats — try reopening the popup.</p>
    <ul class="top" aria-label="Top domains today" v-if="!loadError && topDomains.length">
      <li v-for="d in topDomains" :key="d.domain" :aria-label="`${d.domain}: ${formatDuration(d.seconds)}`">
        <span class="domain">{{ d.domain }}</span>
        <strong>{{ formatDuration(d.seconds) }}</strong>
      </li>
    </ul>
    <p v-else-if="!loadError" class="empty">No activity tracked yet today.</p>
    <div class="stale" role="status" v-if="staleCount">{{ staleCount }} stale {{ staleCount === 1 ? 'tab' : 'tabs' }}</div>
    <button class="cta" @click="openDashboard">Open dashboard</button>
  </main>
</template>

<style scoped>
.popup {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
}
.hero {
  background: var(--color-ink);
  color: #fff;
  border-radius: var(--radius);
  padding: 14px;
  display: flex;
  flex-direction: column;
}
.label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.6;
}
.value {
  font-size: 30px;
  font-weight: 800;
}
.top {
  list-style: none;
  margin: 0;
  padding: 0;
}
.top li {
  display: flex;
  justify-content: space-between;
  padding: 6px 2px;
  border-bottom: 1px solid var(--color-divider);
  font-size: 13px;
}
.domain {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}
.empty {
  font-size: 12px;
  color: #6e6560;
  margin: 0;
}
.stale {
  background: var(--color-warn-bg);
  color: var(--color-warn);
  border-radius: var(--radius);
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
}
.cta {
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.cta:hover {
  filter: brightness(0.93);
}
.cta:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
</style>
