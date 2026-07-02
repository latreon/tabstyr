<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { useI18n } from 'vue-i18n';
import { useStats, type TabListItem } from '@/composables/useStats';
import { useLocale } from '@/composables/useLocale';
import { focusTab } from '@/lib/navigate';
import TabsModal from '@/components/TabsModal.vue';
import HeroTile from '@/components/HeroTile.vue';
import StatTile from '@/components/StatTile.vue';
import TopSitesChart from '@/components/TopSitesChart.vue';
import CategoryChart from '@/components/CategoryChart.vue';
import ProductivityTile from '@/components/ProductivityTile.vue';
import InsightsTile from '@/components/InsightsTile.vue';
import FocusCategoriesTile from '@/components/FocusCategoriesTile.vue';
import TrendChart from '@/components/TrendChart.vue';
import FocusTrend from '@/components/FocusTrend.vue';
import ComparisonTile from '@/components/ComparisonTile.vue';
import HeatmapTile from '@/components/HeatmapTile.vue';
import WorkLog from '@/components/WorkLog.vue';
import ProjectsTile from '@/components/ProjectsTile.vue';
import DomainDetail from '@/components/DomainDetail.vue';
import TabTable from '@/components/TabTable.vue';
import SettingsPanel from '@/components/SettingsPanel.vue';
import CustomizationPanel from '@/components/CustomizationPanel.vue';
import OnboardingCard from '@/components/OnboardingCard.vue';
import RingLogo from '@/components/RingLogo.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import PrivacyDialog from '@/components/PrivacyDialog.vue';
import { COFFEE_URL } from '@/lib/support';

const { t } = useI18n();
const locale = useLocale();
const s = useStats();
const loadedNow = Date.now();
const selected = ref<{ domain: string; now: number } | null>(null);
const showPrivacy = ref(false);
function openDetail(domain: string) {
  selected.value = { domain, now: Date.now() };
}

// --- Tabs modal (open tabs / stale tabs) ---------------------------------
const tabsMode = ref<'open' | 'stale' | null>(null);
const tabsNow = ref(Date.now());
const tabsItems = computed<TabListItem[]>(() =>
  tabsMode.value === 'stale' ? s.staleTabItems.value : s.openTabsList.value,
);
function openTabsModal(mode: 'open' | 'stale') {
  tabsNow.value = Date.now();
  tabsMode.value = mode;
}

// --- Toast with optional undo --------------------------------------------
const toast = ref<{ message: string; undo?: () => void } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function showToast(message: string, undo?: () => void) {
  toast.value = { message, undo };
  clearTimeout(toastTimer);
  // Give a little longer when an action is offered.
  toastTimer = setTimeout(() => (toast.value = null), undo ? 6000 : 2600);
}

async function reopenTabs(items: TabListItem[]) {
  // Cache which windows still exist so we restore each tab into its original
  // window when possible (e.g. a second monitor window), falling back to the
  // current window if that window was since closed.
  const liveWindows = new Set<number>(
    await browser.windows.getAll().then((ws) => ws.map((w) => w.id as number)).catch(() => []),
  );
  for (const item of items) {
    try {
      const u = new URL(item.url);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
      const windowId = item.windowId !== undefined && liveWindows.has(item.windowId) ? item.windowId : undefined;
      await browser.tabs.create({ url: item.url, active: false, ...(windowId !== undefined ? { windowId } : {}) }).catch(() => undefined);
    } catch {
      /* skip unparseable / non-web urls (chrome://, etc.) */
    }
  }
  await s.load({ silent: true });
}

function buildUndo(items: TabListItem[]): (() => void) | undefined {
  // Only http(s) tabs can be reopened by URL — internal pages can't, so don't
  // promise an undo we can't honor.
  const reopenable = items.filter((i) => /^https?:/.test(i.url));
  if (!reopenable.length) return undefined;
  return () => {
    toast.value = null;
    clearTimeout(toastTimer);
    void reopenTabs(reopenable);
  };
}

async function onCloseTab(item: TabListItem) {
  await s.closeTab(item.tabId);
  showToast(t('tabs.closed', { count: 1 }, 1), buildUndo([item]));
}

async function onCloseAll(items: TabListItem[]) {
  await s.closeTabs(items.map((i) => i.tabId));
  showToast(t('tabs.closed', { count: items.length }, items.length), buildUndo(items));
}

function onGoto(tabId: number) {
  tabsMode.value = null;
  void focusTab(tabId);
}
onMounted(async () => {
  await locale.load();
  await s.load();
  // Opened from the popup's Privacy link — show the in-app overlay (no separate page).
  if (location.hash === '#privacy') {
    showPrivacy.value = true;
    history.replaceState(null, '', location.pathname); // drop the hash from the URL
  }
  if (location.hash === '#stale') {
    history.replaceState(null, '', location.pathname); // drop the hash from the URL
    // Opened from the popup's stale button — jump straight into the actionable
    // list instead of just flashing a number the user can't do anything with.
    if (s.staleTabItems.value.length) openTabsModal('stale');
  }
  if (location.hash === '#focus') {
    history.replaceState(null, '', location.pathname);
    // Opened from a budget nudge — scroll the focus tile into view after paint.
    requestAnimationFrame(() => document.getElementById('focus')?.scrollIntoView({ block: 'center' }));
  }
});
</script>

<template>
  <div class="glow" aria-hidden="true" />
  <main class="dashboard">
    <header class="head">
      <h1 class="brand"><RingLogo :size="24" /> TabStyr</h1>
      <div class="head-right">
        <button type="button" class="privacy-badge" :title="t('privacy.badgeTitle')" @click="showPrivacy = true">
          <svg class="shield" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l7 3v5.5c0 4-3 7-7 8.5-4-1.5-7-4.5-7-8.5V6z" />
            <path d="M9 12l2 2 4-4.5" />
          </svg>
          {{ t('privacy.badge') }}
        </button>
        <a v-if="COFFEE_URL" class="coffee-badge tip-right" :href="COFFEE_URL" target="_blank" rel="noopener"
           :data-tip="t('support.coffee')" :aria-label="t('support.coffee')">
          <span aria-hidden="true">☕</span>
        </a>
        <ThemeToggle />
      </div>
    </header>
    <div v-if="s.loading.value" class="bento skel" role="status" aria-live="polite" aria-busy="true" :aria-label="t('common.loading')">
      <div class="sk sk-hero" aria-hidden="true" />
      <div class="sk sk-stat" aria-hidden="true" />
      <div class="sk sk-stat" aria-hidden="true" />
      <div class="sk sk-wide" aria-hidden="true" />
      <div class="sk sk-two" aria-hidden="true" />
      <div class="sk sk-one" aria-hidden="true" />
      <div class="sk sk-row" aria-hidden="true" />
      <div class="sk sk-row" aria-hidden="true" />
    </div>
    <div v-else-if="s.loadError.value" class="load-error" role="alert">
      <p class="label">{{ t('common.loadError') }}</p>
      <button type="button" class="retry-btn" @click="s.load()">{{ t('common.retry') }}</button>
    </div>
    <template v-else>
      <p v-if="s.storageWarning.value" class="storage-warn" role="alert">{{ t('common.storageFull') }}</p>
      <OnboardingCard v-if="s.showOnboarding.value" @dismiss="s.dismissOnboarding" />
      <section class="bento" :aria-label="t('dashboard.statsAria')">
      <HeroTile
        :today-seconds="s.todaySeconds.value"
        :weekly-avg-seconds="s.weeklyAvgSeconds.value"
        :weekly-active-days="s.weeklyActiveDays.value"
        :today-audio-seconds="s.todayAudioSeconds.value"
        :stats="s.activeStats.value"
      />
      <StatTile
        :label="t('stat.openTabs')"
        :value="String(s.openTabCount.value)"
        :clickable="s.openTabsList.value.length > 0"
        :action-hint="t('tabs.manage')"
        @activate="openTabsModal('open')"
      />
      <StatTile
        id="stale-section"
        :label="t('stat.staleTabs')"
        :value="String(s.staleTabs.value.length)"
        :warn="s.staleTabs.value.length > 0"
        :clickable="s.staleTabs.value.length > 0"
        :action-hint="t('tabs.review')"
        @activate="openTabsModal('stale')"
      />
      <!-- Today by category fills the space below Open tabs / Stale tabs, beside the tall hero -->
      <CategoryChart :slices="s.todayByCategory.value" :budgets="s.categoryBudgets.value" :custom="s.customCategories.value" />
      <!-- Top sites today + Focus today -->
      <TopSitesChart :domains="s.todayByDomain.value" @select="openDetail" />
      <ProductivityTile id="focus" :summary="s.productivity.value" />
      <!-- full-width rows -->
      <InsightsTile :insights="s.insights.value" />
      <TrendChart :stats="s.activeStats.value" :now="loadedNow" />
      <FocusTrend :stats="s.activeStats.value" :overrides="s.overrides.value" :rules="s.categoryRules.value" :productivity="s.categoryProductivity.value" :custom="s.customCategories.value" :now="loadedNow" :target="s.productivity.value.focusTarget" />
      <ComparisonTile :stats="s.activeStats.value" :today-key="s.todayKey.value" :overrides="s.overrides.value" :rules="s.categoryRules.value" :custom="s.customCategories.value" />
      <HeatmapTile :data="s.heatmap.value" />
      <WorkLog :stats="s.activeStats.value" :overrides="s.overrides.value" :rules="s.categoryRules.value" :custom="s.customCategories.value" :now="loadedNow" @select="openDetail" @set-category="s.setCategoryOverride" />
      <!-- Projects / clients — tag domains, see time per tag, export invoice/CSV -->
      <ProjectsTile :stats="s.activeStats.value" :overrides="s.overrides.value" :rules="s.categoryRules.value" :domain-tags="s.domainTags.value" :now="loadedNow" />
      <FocusCategoriesTile :productivity="s.categoryProductivity.value" @set="s.setCategoryProductivity" />
      <!-- row: 2 + 1 — Open tabs by time beside Settings -->
      <TabTable :rows="s.tabRows.value" />
      <SettingsPanel @changed="() => s.load({ silent: true })" />
      <CustomizationPanel @changed="() => s.load({ silent: true })" />
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
    :custom="s.customCategories.value"
    @close="selected = null"
    @set-category="s.setCategoryOverride"
  />

  <PrivacyDialog v-if="showPrivacy" @close="showPrivacy = false" />

  <TabsModal
    v-if="tabsMode"
    :mode="tabsMode"
    :items="tabsItems"
    :stale-days="s.settings.value?.staleDays ?? 3"
    :now="tabsNow"
    @close="tabsMode = null"
    @goto="onGoto"
    @close-tab="onCloseTab"
    @close-all="onCloseAll"
  />

  <Teleport to="body">
    <Transition name="toast">
      <div v-if="toast" class="toast" role="status" aria-live="polite">
        <span class="toast-msg">{{ toast.message }}</span>
        <button v-if="toast.undo" type="button" class="toast-undo" @click="toast.undo">{{ t('tabs.undo') }}</button>
      </div>
    </Transition>
  </Teleport>
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
  gap: 7px;
  box-sizing: border-box;
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}
.privacy-badge:hover { border-color: var(--accent); color: var(--text); }
.privacy-badge:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.load-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.retry-btn {
  height: 32px;
  padding: 0 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.retry-btn:hover { border-color: var(--accent); }
.retry-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.storage-warn {
  margin-bottom: 16px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--warn);
  background: var(--warn-bg);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}
.privacy-badge .shield {
  width: 15px;
  height: 15px;
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
.coffee-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text-2);
  font-size: 16px;
  line-height: 1;
  text-decoration: none;
  transition: border-color 120ms ease, color 120ms ease;
}
.coffee-badge:hover { border-color: var(--accent); color: var(--text); }
.coffee-badge:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.bento {
  display: grid;
  /* minmax(0, 1fr) lets tracks shrink below their content's min-content instead
     of expanding the grid wider than its container. */
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space);
  align-items: stretch;
}
/* Loading skeleton — placeholder tiles that mirror the real bento while data loads. */
.skel .sk {
  border-radius: var(--radius);
  background: linear-gradient(100deg, var(--card-strong) 30%, var(--bar-track) 50%, var(--card-strong) 70%);
  background-size: 220% 100%;
  border: 1px solid var(--border);
  animation: sk-shimmer 1.3s ease-in-out infinite;
}
.sk-hero { grid-row: span 2; min-height: 220px; }
.sk-stat { min-height: 100px; }
.sk-wide { grid-column: span 2; min-height: 120px; }
.sk-two { grid-column: span 2; min-height: 150px; }
.sk-one { min-height: 150px; }
.sk-row { grid-column: span 3; min-height: 120px; }
@keyframes sk-shimmer {
  0% { background-position: 180% 0; }
  100% { background-position: -80% 0; }
}
@media (max-width: 760px) {
  .skel > .sk { grid-column: 1 / -1 !important; grid-row: auto !important; }
}
@media (prefers-reduced-motion: reduce) {
  .skel .sk { animation: none; }
}
@media (max-width: 760px) {
  .bento {
    grid-template-columns: minmax(0, 1fr);
  }
  /* Tiles declare `grid-column: span 2/3` for the desktop 3-column grid. In the
     single-column mobile layout that span creates implicit columns and sizes the
     tiles to their content width, overflowing the viewport. Collapse every tile
     to the single track. :deep() pierces the child components' scoped styles. */
  .bento > :deep(*) {
    grid-column: 1 / -1 !important;
  }
}
</style>

<!-- Unscoped: the toast is teleported to <body>, outside this component's scope. -->
<style>
.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: min(440px, calc(100vw - 32px));
  padding: 11px 14px 11px 16px;
  border-radius: 12px;
  background: var(--popover);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-pop);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}
.toast-msg { white-space: nowrap; }
.toast-undo {
  flex: none;
  padding: 5px 12px;
  border-radius: 8px;
  border: none;
  background: var(--accent-grad-strong);
  color: var(--on-accent);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.toast-undo:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.toast-enter-active,
.toast-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.toast-enter-from,
.toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active { transition: opacity 180ms ease; }
  .toast-enter-from,
  .toast-leave-to { transform: translateX(-50%); }
}
</style>
