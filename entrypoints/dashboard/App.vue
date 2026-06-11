<script setup lang="ts">
import { onMounted } from 'vue';
import { useStats } from '@/composables/useStats';
import HeroTile from '@/components/HeroTile.vue';
import StatTile from '@/components/StatTile.vue';
import TopSitesChart from '@/components/TopSitesChart.vue';
import TrendChart from '@/components/TrendChart.vue';
import TabTable from '@/components/TabTable.vue';
import StaleList from '@/components/StaleList.vue';
import SettingsPanel from '@/components/SettingsPanel.vue';

const s = useStats();
onMounted(s.load);
</script>

<template>
  <main class="dashboard">
    <header class="head">
      <h1>Tab Time</h1>
      <span class="label">Local data only — last 90 days</span>
    </header>
    <p v-if="s.loading.value" class="label">Loading…</p>
    <p v-else-if="s.loadError.value" class="label">Could not load data — reload the page.</p>
    <section v-else class="bento" aria-label="Browser usage statistics">
      <HeroTile :today-seconds="s.todaySeconds.value" :weekly-avg-seconds="s.weeklyAvgSeconds.value" :stats="s.stats.value" />
      <StatTile label="Open tabs" :value="String(s.openTabCount.value)" />
      <StatTile
        label="Stale tabs"
        :value="String(s.staleTabs.value.length)"
        :warn="s.staleTabs.value.length > 0"
      />
      <TopSitesChart :domains="s.todayByDomain.value" />
      <TrendChart :stats="s.stats.value" />
      <TabTable :rows="s.tabRows.value" />
      <StaleList :tabs="s.staleTabs.value" @close="s.closeTab" @snooze="s.snoozeTab" />
      <SettingsPanel @changed="s.load" />
    </section>
  </main>
</template>

<style scoped>
.dashboard {
  max-width: 1080px;
  margin: 0 auto;
  padding: 28px var(--space);
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20px;
}
.bento {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: var(--space);
  align-items: start;
}
@media (max-width: 760px) {
  .bento {
    grid-template-columns: 1fr;
  }
}
</style>
