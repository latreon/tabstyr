<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { buildWorkLog, workLogText } from '@/lib/worklog';
import { CATEGORIES, CATEGORY_META, type Category, type CategoryRule } from '@/lib/categories';
import { addDays, dateKey, formatDuration, longDateLabel } from '@/lib/time';
import { displayDomain } from '@/lib/domain';
import type { DailyStat } from '@/lib/types';
import FaviconChip from '@/components/FaviconChip.vue';
import DatePicker from '@/components/ui/DatePicker.vue';

const props = defineProps<{
  stats: DailyStat[];
  overrides: Record<string, Category>;
  rules?: CategoryRule[];
  now: number;
}>();
const emit = defineEmits<{ select: [domain: string] }>();
const { t } = useI18n();

const today = dateKey(props.now);
const minDate = addDays(today, -89);

const selected = ref(today);
const copied = ref(false);

const log = computed(() => buildWorkLog(props.stats, selected.value, props.overrides, props.rules ?? []));
const isToday = computed(() => selected.value === today);

const canPrev = computed(() => selected.value > minDate);
const canNext = computed(() => selected.value < today);

function step(days: number) {
  const next = addDays(selected.value, days);
  if (next >= minDate && next <= today) selected.value = next;
}

// Category colours that appear as dots next to each site — shown as a legend so
// the meaning is clear at a glance.
const legend = CATEGORIES.map((c) => ({ category: c, color: CATEGORY_META[c].color }));

async function copy() {
  try {
    await navigator.clipboard.writeText(workLogText(log.value));
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch (e) {
    console.error('[worklog] copy failed', e);
  }
}
</script>

<template>
  <div class="tile worklog-tile">
    <div class="wl-head">
      <span class="label">{{ t('worklog.title') }}</span>
      <div class="wl-controls">
        <button class="nav" :disabled="!canPrev" :aria-label="t('worklog.prevDay')" @click="step(-1)">‹</button>
        <DatePicker v-model="selected" :min="minDate" :max="today" />
        <button class="nav" :disabled="!canNext" :aria-label="t('worklog.nextDay')" @click="step(1)">›</button>
        <button class="copy" :disabled="!log.total" @click="copy">{{ copied ? t('worklog.copied') : t('worklog.copy') }}</button>
      </div>
    </div>

    <p class="wl-line">
      <strong>{{ isToday ? t('common.today') : longDateLabel(selected) }}</strong>
      <template v-if="log.total">
        {{ t('worklog.summary', { time: formatDuration(log.total), count: log.domains.length }, log.domains.length) }}
      </template>
      <template v-else>{{ t('worklog.nothingTracked') }}</template>
    </p>

    <ol v-if="log.total" class="sites">
      <li v-for="d in log.domains" :key="d.domain">
        <button class="site" :aria-label="t('worklog.viewSiteAria', { domain: displayDomain(d.domain), category: t(`categories.${d.category}`) })" @click="emit('select', d.domain)">
          <FaviconChip :domain="d.domain" />
          <span class="site-name">{{ displayDomain(d.domain) }}</span>
          <span class="dot" :style="{ background: CATEGORY_META[d.category].color }" :title="t('worklog.categoryTitle', { category: t(`categories.${d.category}`) })" aria-hidden="true" />
          <span class="site-time">{{ formatDuration(d.seconds) }}</span>
        </button>
      </li>
    </ol>

    <ul v-if="log.total" class="legend" :aria-label="t('worklog.legendAria')">
      <li v-for="l in legend" :key="l.category">
        <span class="dot" :style="{ background: l.color }" aria-hidden="true" />
        {{ t(`categories.${l.category}`) }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.worklog-tile {
  padding: 16px;
  grid-column: span 3;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-2);
}
.wl-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}
.nav {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text-2);
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
}
.nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.date {
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  font-family: inherit;
  color-scheme: light dark;
}
.copy {
  margin-left: 4px;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text-2);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.copy:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--text);
}
.copy:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.nav:focus-visible,
.copy:focus-visible,
.date:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.wl-line {
  margin: 0;
  font-size: 14px;
  color: var(--text-2);
  line-height: 1.5;
}
.wl-line .accent {
  color: var(--text);
}
.sites {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2px 16px;
}
.site {
  all: unset;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 18px 1fr 10px auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
}
.site:hover {
  background: var(--row-hover);
}
.site:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.site-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.legend {
  list-style: none;
  margin: 4px 0 0;
  padding: 12px 0 0;
  border-top: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-3);
}
.legend .dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.site-time {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
}
</style>
