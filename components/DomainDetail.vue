<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { buildTrend } from '@/lib/trend';
// import { buildHourlyHeatmap } from '@/lib/heatmap'; // Activity heatmap hidden in the site modal (commented out, not removed)
import { coalesceSessions } from '@/lib/sessionize';
import { topSubPages } from '@/lib/subpages';
import { formatDuration } from '@/lib/time';
import { openDomain, openPage } from '@/lib/navigate';
import { isWebDomain, displayDomain } from '@/lib/domain';
import { CATEGORIES, categorize, type Category, type CategoryRule } from '@/lib/categories';
import type { DailyStat, Session } from '@/lib/types';
import FaviconChip from '@/components/FaviconChip.vue';
// import HeatmapTile from '@/components/HeatmapTile.vue'; // Activity heatmap hidden in the site modal (commented out, not removed)
import SelectBox from '@/components/ui/SelectBox.vue';
import { useFocusTrap } from '@/composables/useFocusTrap';

const props = defineProps<{
  domain: string;
  stats: DailyStat[];
  sessions: Session[];
  now: number;
  overrides: Record<string, Category>;
  rules?: CategoryRule[];
}>();
const emit = defineEmits<{ close: []; setCategory: [domain: string, category: Category] }>();

const { t } = useI18n();
const CATEGORY_OPTIONS = computed(() => CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) })));
const currentCategory = computed(() => categorize(props.domain, props.overrides, props.rules ?? []));

const closeBtn = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);

useFocusTrap(panel);

const domainStats = computed(() => props.stats.filter((s) => s.domain === props.domain));
const domainSessions = computed(() => props.sessions.filter((s) => s.domain === props.domain));

const totalSeconds = computed(() => domainStats.value.reduce((sum, s) => sum + s.seconds, 0));
const audioSeconds = computed(() => domainStats.value.reduce((sum, s) => sum + s.audioSeconds, 0));
const grandTotal = computed(() => props.stats.reduce((sum, s) => sum + s.seconds, 0));
const sharePct = computed(() =>
  grandTotal.value ? Math.round((totalSeconds.value / grandTotal.value) * 100) : 0,
);
const daysActive = computed(() => new Set(domainStats.value.map((s) => s.date)).size);
// Stitch the 1-minute heartbeat rows back into real visits so these counts reflect
// actual browsing, not how many checkpoints fired.
const visits = computed(() => coalesceSessions(domainSessions.value));
const sessionCount = computed(() => visits.value.length);
const avgSession = computed(() =>
  sessionCount.value ? Math.round(totalSeconds.value / sessionCount.value) : 0,
);
const longestSession = computed(() =>
  visits.value.reduce((max, v) => Math.max(max, Math.round((v.end - v.start) / 1000)), 0),
);

// Sub-page (SPA) breakdown — only meaningful when the site has more than one
// tracked page. Labels the bare root path via a localized "Home".
const subPages = computed(() => topSubPages(domainSessions.value));
const hasSubPages = computed(() => subPages.value.pages.length > 1);
const subPageMax = computed(() => Math.max(1, ...subPages.value.pages.map((p) => p.seconds)));
const pageLabel = (path: string) => (path === '/' ? t('domainDetail.homePath') : path);

const trend = computed(() => buildTrend(domainStats.value, 'day', props.now));
const trendMax = computed(() => Math.max(1, ...trend.value.map((p) => p.seconds)));
// const domainHeatmap = computed(() => buildHourlyHeatmap(domainSessions.value)); // Activity heatmap hidden in the site modal (commented out, not removed)

const tip = ref<{ text: string; x: number; bottom: number } | null>(null);
function showTip(e: Event, label: string, seconds: number) {
  const col = e.currentTarget as HTMLElement;
  const host = col.closest('.bars') as HTMLElement;
  const rect = col.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  // Sit the tooltip just above this bar's filled top, so it tracks bar height
  // (matches the dashboard trend chart) instead of pinning to the chart's top.
  const fill = col.querySelector('.bar-fill') as HTMLElement | null;
  const fillH = fill ? fill.getBoundingClientRect().height : 0;
  const halfW = 64;
  tip.value = {
    text: `${label} — ${formatDuration(seconds)}`,
    x: Math.max(halfW, Math.min(rect.left - hostRect.left + rect.width / 2, hostRect.width - halfW)),
    bottom: fillH + 8,
  };
}
const hideTip = () => (tip.value = null);

const metrics = computed(() => [
  { label: t('domainDetail.total90d'), value: formatDuration(totalSeconds.value) },
  { label: t('domainDetail.shareOfAll'), value: `${sharePct.value}%` },
  { label: t('domainDetail.sessions'), value: String(sessionCount.value) },
  { label: t('domainDetail.avgSession'), value: formatDuration(avgSession.value) },
  { label: t('domainDetail.longestSession'), value: formatDuration(longestSession.value) },
  { label: t('domainDetail.activeDays'), value: String(daysActive.value) },
  ...(audioSeconds.value ? [{ label: t('domainDetail.audio'), value: formatDuration(audioSeconds.value) }] : []),
]);

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
onMounted(() => {
  document.addEventListener('keydown', onKey);
  // Lock the page behind the modal so the backdrop scrolls, not the dashboard.
  document.body.style.overflow = 'hidden';
  closeBtn.value?.focus();
});
onUnmounted(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
  <div class="backdrop" @click.self="emit('close')">
    <div ref="panel" class="panel tile" role="dialog" aria-modal="true" :aria-label="t('domainDetail.detailsForAria', { domain: displayDomain(domain) })">
      <header class="head">
        <FaviconChip :domain="domain" />
        <h2 class="title">{{ displayDomain(domain) }}</h2>
        <button
          v-if="isWebDomain(domain)"
          class="open"
          @click="openDomain(domain)"
        >{{ t('domainDetail.open') }}</button>
        <button ref="closeBtn" class="close" :aria-label="t('domainDetail.close')" @click="emit('close')">✕</button>
      </header>

      <div class="cat-row">
        <span class="cat-label">{{ t('domainDetail.category') }}</span>
        <SelectBox
          :model-value="currentCategory"
          :options="CATEGORY_OPTIONS"
          :label="t('domainDetail.category')"
          @update:model-value="emit('setCategory', domain, $event as Category)"
        />
      </div>

      <div class="stat-grid">
        <div v-for="m in metrics" :key="m.label" class="stat">
          <span class="stat-value">{{ m.value }}</span>
          <span class="stat-label">{{ m.label }}</span>
        </div>
      </div>

      <section class="block" :aria-label="t('domainDetail.last14Aria')">
        <span class="label">{{ t('domainDetail.last14') }}</span>
        <div class="bars">
          <div
            v-for="p in trend"
            :key="p.key"
            class="bar-col"
            tabindex="0"
            :aria-label="`${p.label} — ${formatDuration(p.seconds)}`"
            @mouseenter="showTip($event, p.label, p.seconds)"
            @mouseleave="hideTip"
            @focus="showTip($event, p.label, p.seconds)"
            @blur="hideTip"
          >
            <div class="bar-fill" :style="{ height: `${(p.seconds / trendMax) * 100}%` }" />
          </div>
          <div v-if="tip" class="bar-tip" :style="{ left: `${tip.x}px`, bottom: `${tip.bottom}px` }" aria-hidden="true">{{ tip.text }}</div>
        </div>
        <div class="bar-labels">
          <span>{{ trend[0]?.label }}</span>
          <span>{{ trend[trend.length - 1]?.label }}</span>
        </div>
      </section>

      <section v-if="hasSubPages" class="block" :aria-label="t('domainDetail.topPagesAria')">
        <span class="label">{{ t('domainDetail.topPages') }}</span>
        <ul class="pages">
          <li v-for="p in subPages.pages" :key="p.path" class="page-row">
            <button
              v-if="isWebDomain(domain)"
              type="button"
              class="page-path page-link"
              :title="pageLabel(p.path)"
              @click="openPage(domain, p.path)"
            >{{ pageLabel(p.path) }}</button>
            <span v-else class="page-path" :title="pageLabel(p.path)">{{ pageLabel(p.path) }}</span>
            <span class="page-bar-track" aria-hidden="true">
              <span class="page-bar-fill" :style="{ width: `${(p.seconds / subPageMax) * 100}%` }" />
            </span>
            <span class="page-time">{{ formatDuration(p.seconds) }}</span>
          </li>
        </ul>
        <p v-if="subPages.otherCount" class="pages-more">
          {{ t('domainDetail.otherPages', { count: subPages.otherCount }) }}
        </p>
      </section>

      <!-- Activity heatmap hidden in the site modal for now (commented out, not removed).
      <section class="block" :aria-label="t('domainDetail.byHourAria')">
        <HeatmapTile :data="domainHeatmap" />
      </section>
      -->
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 6vh 16px 16px;
  background: rgba(8, 8, 16, 0.55);
  backdrop-filter: blur(3px);
  overflow-y: auto;
}
.panel {
  width: min(720px, 100%);
  background: var(--popover);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.open {
  margin-left: auto;
  background: var(--accent-grad-strong);
  color: var(--on-accent);
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.close {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-2);
  border-radius: 8px;
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: 13px;
}
.open:focus-visible,
.close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.cat-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cat-label {
  font-size: 13px;
  color: var(--text-2);
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  background: var(--card-strong);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.stat-value {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.stat-label {
  font-size: 11px;
  color: var(--text-3);
}
.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bars {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 90px;
}
.bar-col {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
  cursor: default;
  border-radius: 3px;
}
.bar-col:hover { background: var(--row-hover); }
.bar-col:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.bar-tip {
  position: absolute;
  bottom: calc(100% + 6px);
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text);
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: 7px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
  pointer-events: none;
  z-index: 5;
}
.bar-fill {
  width: 100%;
  min-height: 2px;
  background: var(--accent-gradient);
  border-radius: 3px 3px 0 0;
  opacity: 0.9;
}
.bar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-3);
}
.pages {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.page-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(60px, 90px) auto;
  align-items: center;
  gap: 10px;
}
.page-path {
  font-size: 13px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page-link {
  all: unset;
  box-sizing: border-box;
  display: block;
  font-size: 13px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 4px;
}
.page-link:hover { color: var(--accent); text-decoration: underline; }
.page-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.page-bar-track {
  height: 6px;
  border-radius: 3px;
  background: var(--card-strong);
  overflow: hidden;
}
.page-bar-fill {
  display: block;
  height: 100%;
  min-width: 2px;
  border-radius: 3px;
  background: var(--accent-gradient);
}
.page-time {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.pages-more {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-3);
}
/* The embedded heatmap is not in the dashboard grid here — neutralise its span. */
.block :deep(.heatmap-tile) {
  grid-column: auto;
  padding: 0;
  border: none;
  box-shadow: none;
  background: transparent;
}
</style>
