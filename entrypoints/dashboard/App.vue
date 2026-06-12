<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useStats } from '@/composables/useStats';
import HeroTile from '@/components/HeroTile.vue';
import StatTile from '@/components/StatTile.vue';
import TopSitesChart from '@/components/TopSitesChart.vue';
import CategoryChart from '@/components/CategoryChart.vue';
import ProductivityTile from '@/components/ProductivityTile.vue';
import TrendChart from '@/components/TrendChart.vue';
import HeatmapTile from '@/components/HeatmapTile.vue';
import WorkLog from '@/components/WorkLog.vue';
import DomainDetail from '@/components/DomainDetail.vue';
import TabTable from '@/components/TabTable.vue';
import StaleList from '@/components/StaleList.vue';
import SettingsPanel from '@/components/SettingsPanel.vue';
import RingLogo from '@/components/RingLogo.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';

const s = useStats();
const loadedNow = Date.now();
const selected = ref<{ domain: string; now: number } | null>(null);
function openDetail(domain: string) {
  selected.value = { domain, now: Date.now() };
}
onMounted(async () => {
  await s.load();
  if (location.hash === '#stale') {
    document.getElementById('stale-section')?.scrollIntoView({ behavior: 'smooth' });
  }
});
</script>

<template>
  <div class="glow" aria-hidden="true" />
  <main class="dashboard">
    <header class="head">
      <h1 class="brand"><RingLogo :size="24" /> TabStyr</h1>
      <div class="head-right">
        <span class="label">Local only · last 90 days</span>
        <ThemeToggle />
      </div>
    </header>
    <p v-if="s.loading.value" class="label">Loading…</p>
    <p v-else-if="s.loadError.value" class="label">Could not load data — reload the page.</p>
    <section v-else class="bento" aria-label="Browser usage statistics">
      <HeroTile
        :today-seconds="s.todaySeconds.value"
        :weekly-avg-seconds="s.weeklyAvgSeconds.value"
        :weekly-active-days="s.weeklyActiveDays.value"
        :today-audio-seconds="s.todayAudioSeconds.value"
        :stats="s.activeStats.value"
      />
      <StatTile label="Open tabs" :value="String(s.openTabCount.value)" />
      <StatTile
        label="Stale tabs"
        :value="String(s.staleTabs.value.length)"
        :warn="s.staleTabs.value.length > 0"
      />
      <!-- row: 1 + 2 -->
      <ProductivityTile :summary="s.productivity.value" />
      <CategoryChart :slices="s.todayByCategory.value" />
      <!-- row: 2 + 1 -->
      <TopSitesChart :domains="s.todayByDomain.value" @select="openDetail" />
      <StaleList :tabs="s.staleTabs.value" @close="s.closeTab" @snooze="s.snoozeTab" />
      <!-- full-width rows -->
      <TrendChart :stats="s.activeStats.value" />
      <HeatmapTile :data="s.heatmap.value" />
      <WorkLog :stats="s.activeStats.value" :overrides="s.overrides.value" :now="loadedNow" @select="openDetail" />
      <!-- row: 2 + 1 -->
      <TabTable :rows="s.tabRows.value" />
      <SettingsPanel @changed="s.load" />
    </section>
  </main>

  <DomainDetail
    v-if="selected"
    :domain="selected.domain"
    :stats="s.activeStats.value"
    :sessions="s.recentSessions.value"
    :now="selected.now"
    :overrides="s.overrides.value"
    @close="selected = null"
    @set-category="s.setCategoryOverride"
  />
</template>

<style scoped>
.glow {
  position: fixed;
  inset: 0;
  background: var(--surface-glow);
  pointer-events: none;
}
.dashboard {
  position: relative;
  max-width: 1120px;
  margin: 0 auto;
  padding: 28px var(--space);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.head-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bento {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space);
  align-items: stretch;
}
@media (max-width: 760px) {
  .bento {
    grid-template-columns: 1fr;
  }
}
</style>
