<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { buildReport } from '@/lib/report';
import { buildTagReport, tagNames, tagReportCsv } from '@/lib/tags';
import { renderReportCard, canvasToImageBlob, REPORT_MAX_ROWS, type ReportCardContent } from '@/lib/report-card';
import { downloadBlob, downloadFile } from '@/lib/export';
import type { Category, CategoryRule } from '@/lib/categories';
import { addDays, dateKey, formatDuration, longDateLabel } from '@/lib/time';
import { displayDomain } from '@/lib/domain';
import type { DailyStat } from '@/lib/types';
import FaviconChip from '@/components/FaviconChip.vue';
import DatePicker from '@/components/ui/DatePicker.vue';

const props = defineProps<{
  stats: DailyStat[];
  overrides: Record<string, Category>;
  rules?: CategoryRule[];
  domainTags: Record<string, string>;
  now: number;
}>();
const emit = defineEmits<{ setTag: [domain: string, tag: string] }>();
const { t } = useI18n();

const today = dateKey(props.now);
const minDate = addDays(today, -89);
const from = ref(addDays(today, -6)); // default: last 7 days
const to = ref(today);

const report = computed(() =>
  from.value <= to.value ? buildReport(props.stats, from.value, to.value, props.overrides, props.rules ?? []) : null,
);
const tagReport = computed(() => (report.value ? buildTagReport(report.value.domains, props.domainTags) : null));
const existingTags = computed(() => tagNames(props.domainTags));

// Deterministic accent per tag (stable across renders) from a small palette.
const TAG_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#0d9488', '#ef4444'];
function tagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
}

function onTagInput(domain: string, e: Event) {
  emit('setTag', domain, (e.target as HTMLInputElement).value);
}

const rangeLabel = computed(() =>
  from.value === to.value ? longDateLabel(from.value) : `${longDateLabel(from.value)} – ${longDateLabel(to.value)}`,
);

function exportCsv() {
  if (!report.value) return;
  downloadFile(`tabstyr-projects-${from.value}_${to.value}.csv`, tagReportCsv(report.value, props.domainTags), 'text/csv');
}

const exporting = ref(false);
async function exportInvoice() {
  const r = report.value;
  const tr = tagReport.value;
  if (!r || !tr || exporting.value || tr.taggedSeconds === 0) return;
  exporting.value = true;
  try {
    const content: ReportCardContent = {
      heading: t('projects.invoiceHeading'),
      periodLabel: `${rangeLabel.value} · ${t('projects.days', { count: r.days }, r.days)}`,
      totalLabel: t('projects.billable'),
      totalValue: formatDuration(tr.taggedSeconds),
      categoryLabel: t('projects.share'),
      categories: tr.groups.map((g) => ({
        label: g.tag,
        pct: tr.taggedSeconds ? Math.round((g.seconds / tr.taggedSeconds) * 100) : 0,
        color: tagColor(g.tag),
      })),
      sitesLabel: t('projects.byClient'),
      rows: tr.groups.map((g) => ({ label: g.tag, value: formatDuration(g.seconds), color: tagColor(g.tag) })),
      moreLabel: tr.groups.length > REPORT_MAX_ROWS ? t('worklog.moreSites', { count: tr.groups.length - REPORT_MAX_ROWS }) : '',
      footer: 'TabStyr · tabstyr.com',
    };
    const canvas = document.createElement('canvas');
    renderReportCard(canvas, content, 2);
    const blob = await canvasToImageBlob(canvas, 'image/png');
    if (blob) downloadBlob(`tabstyr-invoice-${from.value}_${to.value}.png`, blob);
  } catch (e) {
    console.error('[projects] invoice export failed', e);
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="tile projects-tile">
    <div class="head">
      <h2 class="label">{{ t('projects.title') }}</h2>
      <div class="controls">
        <DatePicker v-model="from" :min="minDate" :max="to" />
        <span class="dash" aria-hidden="true">–</span>
        <DatePicker v-model="to" :min="from" :max="today" />
        <button class="act" :disabled="!report || !report.totalSeconds" @click="exportCsv">{{ t('worklog.csv') }}</button>
        <button class="act" :disabled="!tagReport || tagReport.taggedSeconds === 0 || exporting" @click="exportInvoice">{{ t('projects.invoice') }}</button>
      </div>
    </div>

    <p class="hint">{{ t('projects.hint') }}</p>

    <template v-if="report && report.totalSeconds">
      <!-- Per-tag summary -->
      <ul v-if="tagReport && tagReport.groups.length" class="tag-summary">
        <li v-for="g in tagReport.groups" :key="g.tag">
          <span class="tag-dot" :style="{ background: tagColor(g.tag) }" aria-hidden="true" />
          <span class="tag-name">{{ g.tag }}</span>
          <span class="tag-time">{{ formatDuration(g.seconds) }}</span>
        </li>
        <li v-if="tagReport.untagged.seconds" class="untagged">
          <span class="tag-name">{{ t('projects.untagged') }}</span>
          <span class="tag-time">{{ formatDuration(tagReport.untagged.seconds) }}</span>
        </li>
      </ul>

      <!-- Assign tags to the domains active in this range -->
      <datalist id="tt-tag-options">
        <option v-for="name in existingTags" :key="name" :value="name" />
      </datalist>
      <ul class="domains">
        <li v-for="d in report.domains" :key="d.domain" class="domain-row">
          <FaviconChip :domain="d.domain" />
          <span class="d-name">{{ displayDomain(d.domain) }}</span>
          <span class="d-time">{{ formatDuration(d.seconds) }}</span>
          <input
            class="tag-input"
            type="text"
            list="tt-tag-options"
            maxlength="60"
            :value="domainTags[d.domain] ?? ''"
            :placeholder="t('projects.tagPlaceholder')"
            :aria-label="t('projects.tagForAria', { domain: displayDomain(d.domain) })"
            @change="onTagInput(d.domain, $event)"
          />
        </li>
      </ul>
    </template>
    <p v-else class="empty">{{ t('projects.empty') }}</p>
  </div>
</template>

<style scoped>
.projects-tile {
  padding: 16px;
  grid-column: span 3;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.label { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; color: var(--text-2); }
.controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dash { color: var(--text-3); }
.act {
  box-sizing: border-box;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text-2);
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.act:hover:not(:disabled) { border-color: var(--accent); color: var(--text); }
.act:disabled { opacity: 0.4; cursor: not-allowed; }
.act:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.hint { margin: 0; font-size: 11px; color: var(--text-3); }
.tag-summary {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
}
.tag-summary li {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--card-strong);
  border: 1px solid var(--border);
  font-size: 12px;
}
.tag-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.tag-name { color: var(--text); font-weight: 600; }
.tag-time { color: var(--text-2); font-variant-numeric: tabular-nums; }
.untagged .tag-name { color: var(--text-3); font-weight: 500; }
.domains {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2px 16px;
}
.domain-row {
  display: grid;
  grid-template-columns: 18px 1fr auto 140px;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
}
.domain-row:hover { background: var(--row-hover); }
.d-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); font-size: 13px; }
.d-time { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text-2); font-size: 13px; }
.tag-input {
  box-sizing: border-box;
  width: 140px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 12px;
}
.tag-input::placeholder { color: var(--text-3); }
.tag-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.empty { margin: 0; font-size: 13px; color: var(--text-3); }
@media (max-width: 560px) {
  .domain-row { grid-template-columns: 18px 1fr auto; }
  .tag-input { grid-column: 2 / -1; width: 100%; }
}
</style>
