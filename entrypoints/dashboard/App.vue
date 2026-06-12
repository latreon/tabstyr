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
import RingLogo from '@/components/RingLogo.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';

const s = useStats();
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
      <h1 class="brand"><RingLogo :size="24" /> TabTime</h1>
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
        :stats="s.stats.value"
      />
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
