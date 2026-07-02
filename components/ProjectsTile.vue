<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { buildReport } from '@/lib/report';
import { buildTagReport, tagReportCsv } from '@/lib/tags';
import { renderReportCard, canvasToImageBlob, REPORT_MAX_ROWS, type ReportCardContent } from '@/lib/report-card';
import { downloadBlob, downloadFile } from '@/lib/export';
import type { CategoryId, CategoryRule } from '@/lib/categories';
import { addDays, dateKey, formatDuration, longDateLabel } from '@/lib/time';
import { displayDomain } from '@/lib/domain';
import type { DailyStat } from '@/lib/types';
import FaviconChip from '@/components/FaviconChip.vue';
import DatePicker from '@/components/ui/DatePicker.vue';

const props = defineProps<{
  stats: DailyStat[];
  overrides: Record<string, CategoryId>;
  rules?: CategoryRule[];
  domainTags: Record<string, string>;
  now: number;
}>();
const { t } = useI18n();

const today = dateKey(props.now);
const minDate = addDays(today, -89);
const from = ref(addDays(today, -6)); // default: last 7 days
const to = ref(today);

// props.stats is already active-only (audio excluded) — buildReport expects raw
// stats and subtracts audioSeconds itself, so zero it out here to avoid double-
// subtracting (a domain whose audioSeconds ≥ its already-active seconds would
// otherwise vanish from the exported report/invoice entirely).
const report = computed(() =>
  from.value <= to.value
    ? buildReport(props.stats.map((s) => ({ ...s, audioSeconds: 0 })), from.value, to.value, props.overrides, props.rules ?? [])
    : null,
);
const tagReport = computed(() => (report.value ? buildTagReport(report.value.domains, props.domainTags) : null));

// Deterministic accent per tag (stable across renders) from a small palette.
const TAG_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#0d9488', '#ef4444'];
function tagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
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
      brand: 'TabStyr',
      tagline: 'tabstyr.com',
      theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
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

      <ul class="domains">
        <li v-for="d in report.domains" :key="d.domain" class="domain-row">
          <FaviconChip :domain="d.domain" />
          <span class="d-name">{{ displayDomain(d.domain) }}</span>
          <span v-if="domainTags[d.domain]" class="d-tag">{{ domainTags[d.domain] }}</span>
          <span class="d-time">{{ formatDuration(d.seconds) }}</span>
        </li>
      </ul>
    </template>
    <p v-else class="empty">{{ t('projects.empty') }}</p>
  </div>
</template>

<style scoped>
.projects-tile {
  padding: var(--sp-4);
  grid-column: span 3;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.label { font-size: var(--text-sm); font-weight: 700; letter-spacing: 0.5px; color: var(--text-2); }
.controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dash { color: var(--text-3); }
.act {
  box-sizing: border-box;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text-2);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}
.act:hover:not(:disabled) { border-color: var(--accent); color: var(--text); }
.act:disabled { opacity: 0.4; cursor: not-allowed; }
.act:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.hint { margin: 0; font-size: var(--text-xs); color: var(--text-3); }
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
  padding: 5px var(--sp-3);
  border-radius: var(--radius-pill);
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
  gap: var(--sp-2) 20px;
}
.domain-row {
  display: grid;
  grid-template-columns: 18px 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--radius-sm);
}
.domain-row:hover { background: var(--row-hover); }
.d-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); font-size: var(--text-sm); }
.d-tag {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-3);
  padding: 1px var(--sp-2);
  border-radius: var(--radius-pill);
  background: var(--card-strong);
  border: 1px solid var(--border);
  white-space: nowrap;
}
.d-time { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text-2); font-size: var(--text-sm); }
.empty { margin: 0; font-size: var(--text-sm); color: var(--text-3); }
</style>
