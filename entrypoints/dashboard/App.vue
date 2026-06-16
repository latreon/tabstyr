<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStats } from '@/composables/useStats';
import { useLocale } from '@/composables/useLocale';
import HeroTile from '@/components/HeroTile.vue';
import StatTile from '@/components/StatTile.vue';
import TopSitesChart from '@/components/TopSitesChart.vue';
import CategoryChart from '@/components/CategoryChart.vue';
import ProductivityTile from '@/components/ProductivityTile.vue';
import TrendChart from '@/components/TrendChart.vue';
import ComparisonTile from '@/components/ComparisonTile.vue';
import HeatmapTile from '@/components/HeatmapTile.vue';
import WorkLog from '@/components/WorkLog.vue';
import DomainDetail from '@/components/DomainDetail.vue';
import TabTable from '@/components/TabTable.vue';
import SettingsPanel from '@/components/SettingsPanel.vue';
import OnboardingCard from '@/components/OnboardingCard.vue';
import RingLogo from '@/components/RingLogo.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';

const { t } = useI18n();
const locale = useLocale();
const s = useStats();
const loadedNow = Date.now();
const selected = ref<{ domain: string; now: number } | null>(null);
function openDetail(domain: string) {
  selected.value = { domain, now: Date.now() };
}
onMounted(async () => {
  await locale.load();
  await s.load();
  if (location.hash === '#stale') {
    const el = document.getElementById('stale-section');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    // Brief pulse so the jump is obvious — the stale count is a small tile.
    el?.classList.add('flash');
    setTimeout(() => el?.classList.remove('flash'), 1600);
  }
});
</script>

<template>
  <div class="glow" aria-hidden="true" />
  <main class="dashboard">
    <header class="head">
      <h1 class="brand"><RingLogo :size="24" /> TabStyr</h1>
      <div class="head-right">
        <a class="privacy-badge" href="/privacy.html" target="_blank" rel="noopener"
           :title="t('privacy.badgeTitle')">
          <svg class="shield" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l7 3v5.5c0 4-3 7-7 8.5-4-1.5-7-4.5-7-8.5V6z" />
            <path d="M9 12l2 2 4-4.5" />
          </svg>
          {{ t('privacy.badge') }}
        </a>
        <ThemeToggle />
      </div>
    </header>
    <p v-if="s.loading.value" class="label">{{ t('common.loading') }}</p>
    <p v-else-if="s.loadError.value" class="label">{{ t('common.loadError') }}</p>
    <template v-else>
      <OnboardingCard v-if="s.showOnboarding.value" @dismiss="s.dismissOnboarding" />
      <section class="bento" :aria-label="t('dashboard.statsAria')">
      <HeroTile
        :today-seconds="s.todaySeconds.value"
        :weekly-avg-seconds="s.weeklyAvgSeconds.value"
        :weekly-active-days="s.weeklyActiveDays.value"
        :today-audio-seconds="s.todayAudioSeconds.value"
        :stats="s.activeStats.value"
      />
      <StatTile :label="t('stat.openTabs')" :value="String(s.openTabCount.value)" />
      <StatTile
        id="stale-section"
        :label="t('stat.staleTabs')"
        :value="String(s.staleTabs.value.length)"
        :warn="s.staleTabs.value.length > 0"
      />
      <!-- Today by category fills the space below Open tabs / Stale tabs, beside the tall hero -->
      <CategoryChart :slices="s.todayByCategory.value" />
      <!-- Top sites today + Focus today -->
      <TopSitesChart :domains="s.todayByDomain.value" @select="openDetail" />
      <ProductivityTile :summary="s.productivity.value" />
      <!-- full-width rows -->
      <TrendChart :stats="s.activeStats.value" />
      <ComparisonTile :stats="s.activeStats.value" :today-key="s.todayKey.value" :overrides="s.overrides.value" :rules="s.categoryRules.value" />
      <HeatmapTile :data="s.heatmap.value" />
      <WorkLog :stats="s.activeStats.value" :overrides="s.overrides.value" :rules="s.categoryRules.value" :now="loadedNow" @select="openDetail" />
      <!-- row: 2 + 1 -->
      <TabTable :rows="s.tabRows.value" />
      <SettingsPanel @changed="() => s.load({ silent: true })" />
      </section>
    </template>
  </main>

  <DomainDetail
    v-if="selected"
    :domain="selected.domain"
    :stats="s.activeStats.value"
    :sessions="s.recentSessions.value"
    :now="selected.now"
    :overrides="s.overrides.value"
    :rules="s.categoryRules.value"
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
.privacy-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}
.privacy-badge:hover { border-color: var(--accent); color: var(--text); }
.privacy-badge:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.privacy-badge .shield {
  width: 13px;
  height: 13px;
  flex: none;
  fill: none;
  stroke: var(--positive);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
@media (max-width: 760px) {
  .privacy-badge { display: none; } /* keep the compact header clean on phones */
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

<!-- Unscoped: targets the StatTile root by id, which scoped styles can't reach. -->
<style>
#stale-section.flash {
  animation: stale-flash 1.6s ease;
}
@keyframes stale-flash {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  20% { box-shadow: 0 0 0 3px var(--warn, #b0552f); }
}
@media (prefers-reduced-motion: reduce) {
  #stale-section.flash { animation: none; }
}
</style>
