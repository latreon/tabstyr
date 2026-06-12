<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { buildTrend } from '@/lib/trend';
import { buildHourlyHeatmap } from '@/lib/heatmap';
import { formatDuration } from '@/lib/time';
import { openDomain } from '@/lib/navigate';
import { isWebDomain } from '@/lib/domain';
import { CATEGORIES, categorize, type Category } from '@/lib/categories';
import type { DailyStat, Session } from '@/lib/types';
import FaviconChip from '@/components/FaviconChip.vue';
import HeatmapTile from '@/components/HeatmapTile.vue';
import SelectBox from '@/components/ui/SelectBox.vue';

const props = defineProps<{
  domain: string;
  stats: DailyStat[];
  sessions: Session[];
  now: number;
  overrides: Record<string, Category>;
}>();
const emit = defineEmits<{ close: []; setCategory: [domain: string, category: Category] }>();

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c, label: c }));
const currentCategory = computed(() => categorize(props.domain, props.overrides));

const closeBtn = ref<HTMLButtonElement | null>(null);

const domainStats = computed(() => props.stats.filter((s) => s.domain === props.domain));
const domainSessions = computed(() => props.sessions.filter((s) => s.domain === props.domain));

const totalSeconds = computed(() => domainStats.value.reduce((sum, s) => sum + s.seconds, 0));
const audioSeconds = computed(() => domainStats.value.reduce((sum, s) => sum + s.audioSeconds, 0));
const grandTotal = computed(() => props.stats.reduce((sum, s) => sum + s.seconds, 0));
const sharePct = computed(() =>
  grandTotal.value ? Math.round((totalSeconds.value / grandTotal.value) * 100) : 0,
);
const daysActive = computed(() => new Set(domainStats.value.map((s) => s.date)).size);
const sessionCount = computed(() => domainSessions.value.length);
const avgSession = computed(() =>
  sessionCount.value ? Math.round(totalSeconds.value / sessionCount.value) : 0,
);
const longestSession = computed(() =>
  domainSessions.value.reduce((max, s) => Math.max(max, Math.round((s.end - s.start) / 1000)), 0),
);

const trend = computed(() => buildTrend(domainStats.value, 'day', props.now));
const trendMax = computed(() => Math.max(1, ...trend.value.map((p) => p.seconds)));
const domainHeatmap = computed(() => buildHourlyHeatmap(domainSessions.value));

const metrics = computed(() => [
  { label: 'Total (90d)', value: formatDuration(totalSeconds.value) },
  { label: 'Share of all time', value: `${sharePct.value}%` },
  { label: 'Sessions', value: String(sessionCount.value) },
  { label: 'Avg session', value: formatDuration(avgSession.value) },
  { label: 'Longest session', value: formatDuration(longestSession.value) },
  { label: 'Active days', value: String(daysActive.value) },
  ...(audioSeconds.value ? [{ label: 'Audio', value: formatDuration(audioSeconds.value) }] : []),
]);

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
onMounted(() => {
  document.addEventListener('keydown', onKey);
  closeBtn.value?.focus();
});
onUnmounted(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="panel tile" role="dialog" aria-modal="true" :aria-label="`Details for ${domain}`">
      <header class="head">
        <FaviconChip :domain="domain" />
        <h2 class="title">{{ domain }}</h2>
        <button
          v-if="isWebDomain(domain)"
          class="open"
          @click="openDomain(domain)"
        >Open ↗</button>
        <button ref="closeBtn" class="close" aria-label="Close details" @click="emit('close')">✕</button>
      </header>

      <div class="cat-row">
        <span class="cat-label">Category</span>
        <SelectBox
          :model-value="currentCategory"
          :options="CATEGORY_OPTIONS"
          label="Category"
          @update:model-value="emit('setCategory', domain, $event as Category)"
        />
      </div>

      <div class="stat-grid">
        <div v-for="m in metrics" :key="m.label" class="stat">
          <span class="stat-value">{{ m.value }}</span>
          <span class="stat-label">{{ m.label }}</span>
        </div>
      </div>

      <section class="block" aria-label="Daily time, last 14 days">
        <span class="label">Last 14 days</span>
        <div class="bars">
          <div
            v-for="p in trend"
            :key="p.key"
            class="bar-col"
            :title="`${p.label} — ${formatDuration(p.seconds)}`"
          >
            <div class="bar-fill" :style="{ height: `${(p.seconds / trendMax) * 100}%` }" />
          </div>
        </div>
        <div class="bar-labels">
          <span>{{ trend[0]?.label }}</span>
          <span>{{ trend[trend.length - 1]?.label }}</span>
        </div>
      </section>

      <section class="block" aria-label="Activity by hour">
        <HeatmapTile :data="domainHeatmap" />
      </section>
    </div>
  </div>
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
  background: var(--accent-gradient);
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
/* The embedded heatmap is not in the dashboard grid here — neutralise its span. */
.block :deep(.heatmap-tile) {
  grid-column: auto;
  padding: 0;
  border: none;
  box-shadow: none;
  background: transparent;
}
</style>
