<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { buildWorkLog, workLogText } from '@/lib/worklog';
import { buildReport, reportCsv } from '@/lib/report';
import { renderReportCard, canvasToImageBlob, REPORT_MAX_ROWS, type ReportCardContent } from '@/lib/report-card';
import { downloadBlob, downloadFile } from '@/lib/export';
import { allCategoryIds, categoryColor, categoryLabel, type CategoryId, type CategoryRule, type CustomCategory } from '@/lib/categories';
import { addDays, dateKey, formatDuration, longDateLabel } from '@/lib/time';
import { displayDomain } from '@/lib/domain';
import type { DailyStat } from '@/lib/types';
import FaviconChip from '@/components/FaviconChip.vue';
import DatePicker from '@/components/ui/DatePicker.vue';
import CategoryPicker from '@/components/CategoryPicker.vue';

const props = defineProps<{
  stats: DailyStat[];
  overrides: Record<string, CategoryId>;
  rules?: CategoryRule[];
  custom?: CustomCategory[];
  now: number;
}>();
const emit = defineEmits<{ select: [domain: string]; setCategory: [domain: string, category: CategoryId] }>();
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
const legend = computed(() =>
  allCategoryIds(props.custom).map((c) => ({ category: c, color: categoryColor(c, props.custom), label: categoryLabel(c, t) })),
);

async function copy() {
  try {
    await navigator.clipboard.writeText(workLogText(log.value));
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch (e) {
    console.error('[worklog] copy failed', e);
  }
}

const exporting = ref(false);

// A single day's report drives both exports (buildReport supports ranges too — the
// project/client invoicing feature reuses it over a wider window). props.stats is
// already active-only, which is exactly what buildReport now expects.
const report = computed(() =>
  buildReport(props.stats, selected.value, selected.value, props.overrides, props.rules ?? []),
);

function exportCsv() {
  downloadFile(`tabstyr-report-${selected.value}.csv`, reportCsv(report.value), 'text/csv');
}

async function exportPng() {
  if (exporting.value || !report.value.totalSeconds) return;
  exporting.value = true;
  try {
    const r = report.value;
    const content: ReportCardContent = {
      heading: t('worklog.reportHeading'),
      periodLabel: longDateLabel(r.from),
      totalLabel: t('worklog.totalActive'),
      totalValue: formatDuration(r.totalSeconds),
      categoryLabel: t('worklog.byCategory'),
      categories: r.categories.map((c) => ({
        label: categoryLabel(c.category, t),
        pct: r.totalSeconds ? Math.round((c.seconds / r.totalSeconds) * 100) : 0,
        color: categoryColor(c.category, props.custom),
      })),
      sitesLabel: t('worklog.bySite'),
      rows: r.domains.map((d) => ({
        label: displayDomain(d.domain),
        value: formatDuration(d.seconds),
        color: categoryColor(d.category, props.custom),
      })),
      moreLabel: r.domains.length > REPORT_MAX_ROWS ? t('worklog.moreSites', { count: r.domains.length - REPORT_MAX_ROWS }) : '',
      brand: 'TabStyr',
      tagline: 'tabstyr.com',
      theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
    };
    const canvas = document.createElement('canvas');
    renderReportCard(canvas, content, 2);
    const blob = await canvasToImageBlob(canvas, 'image/png');
    if (blob) downloadBlob(`tabstyr-report-${selected.value}.png`, blob);
  } catch (e) {
    console.error('[worklog] png export failed', e);
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="tile worklog-tile">
    <div class="wl-head">
      <h2 class="label">{{ t('worklog.title') }}</h2>
      <div class="wl-controls">
        <button class="nav" :disabled="!canPrev" :aria-label="t('worklog.prevDay')" @click="step(-1)">‹</button>
        <DatePicker v-model="selected" :min="minDate" :max="today" />
        <button class="nav" :disabled="!canNext" :aria-label="t('worklog.nextDay')" @click="step(1)">›</button>
        <button class="copy" :disabled="!log.total" @click="copy">{{ copied ? t('worklog.copied') : t('worklog.copy') }}</button>
        <button class="copy" :disabled="!log.total" @click="exportCsv">{{ t('worklog.csv') }}</button>
        <button class="copy" :disabled="!log.total || exporting" @click="exportPng">{{ t('worklog.png') }}</button>
      </div>
    </div>

    <p class="wl-line">
      <strong>{{ isToday ? t('common.today') : longDateLabel(selected) }}</strong>{{ ' ' }}<span v-if="log.total">{{ t('worklog.summary', { time: formatDuration(log.total), count: log.domains.length }, log.domains.length) }}</span><span v-else>{{ t('worklog.nothingTracked') }}</span>
    </p>

    <ol v-if="log.total" class="sites">
      <li v-for="d in log.domains" :key="d.domain" class="site-row">
        <button class="site" :aria-label="t('worklog.viewSiteAria', { domain: displayDomain(d.domain), category: categoryLabel(d.category, t) })" @click="emit('select', d.domain)">
          <FaviconChip :domain="d.domain" />
          <span class="site-name">{{ displayDomain(d.domain) }}</span>
        </button>
        <CategoryPicker :current="d.category" :custom="custom" @select="(c) => emit('setCategory', d.domain, c)" />
        <span class="site-time">{{ formatDuration(d.seconds) }}</span>
      </li>
    </ol>

    <ul v-if="log.total" class="legend" :aria-label="t('worklog.legendAria')">
      <li v-for="l in legend" :key="l.category">
        <span class="dot" :style="{ background: l.color }" aria-hidden="true" />
        {{ l.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.worklog-tile {
  padding: var(--sp-4);
  grid-column: span 3;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.wl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.label {
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-2);
}
.wl-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap; /* Copy/CSV/Image + date nav wrap instead of overflowing on narrow widths */
}
.nav {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 18px;
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
  border-radius: var(--radius-sm);
  padding: var(--sp-1) var(--sp-2);
  font-size: 12px;
  font-family: inherit;
  color-scheme: light dark;
}
.copy {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  height: 34px;
  margin-left: var(--sp-1);
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text-2);
  border-radius: var(--radius-sm);
  padding: 0 var(--sp-4);
  font-size: var(--text-sm);
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
  gap: 2px var(--sp-4);
}
.site-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: var(--sp-2);
  padding: 2px var(--sp-2);
  border-radius: var(--radius-sm);
}
.site-row:hover {
  background: var(--row-hover);
}
.site {
  all: unset;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 18px 1fr;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 7px 0;
  cursor: pointer;
  font-size: var(--text-sm);
}
.site:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: var(--radius-sm);
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
  margin: var(--sp-1) 0 0;
  padding: var(--sp-3) 0 0;
  border-top: 1px solid color-mix(in oklab, var(--text-3) 55%, transparent);
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs);
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
