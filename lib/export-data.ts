import { isWebDomain } from './domain';
import { activeSeconds } from './metrics';
import { categoryProductivityOf, makeCategorizer, type Productivity } from './categories';
import { csvField, hm } from './report';
import type { DailyStat, MonthlyStat, Settings } from './types';

// Flat, spreadsheet-ready export of all tracked activity — one row per
// (period, domain), each stamped with its category and productivity
// classification at export time. This is a one-way analysis export (Excel /
// Google Sheets), distinct from lib/export.ts's toJsonBackup: that format is
// the versioned, re-importable restore schema; this one has no matching
// importer and never will — it's read-only output.

export interface ExportRow {
  period: string; // YYYY-MM-DD for a daily row, YYYY-MM for an archived-monthly row
  granularity: 'day' | 'month';
  domain: string;
  category: string;
  productivity: Productivity;
  activeSeconds: number; // foreground time (audio already excluded)
  activeHm: string; // H:MM, derived from activeSeconds
  audioSeconds: number; // background-audio time, tracked separately
}

type CategorySettings = Pick<Settings, 'categoryOverrides' | 'categoryRules' | 'categoryProductivity' | 'customCategories'>;

/**
 * Build one row per (day or archived-month, domain) across the full dataset —
 * recent daily rows and the pruned-month archive both included, so the export
 * covers the account's whole history, not just the 90-day retention window.
 * Web domains only, matching the report/dashboard convention. A row survives
 * if it has any foreground OR background-audio time; only fully-zero rows drop.
 */
export function buildExportRows(
  dailyStats: readonly DailyStat[],
  monthlyStats: readonly MonthlyStat[],
  settings: CategorySettings,
): ExportRow[] {
  const categoryOf = makeCategorizer(settings.categoryOverrides, settings.categoryRules);

  const rowFor = (period: string, granularity: 'day' | 'month', domain: string, active: number, audio: number): ExportRow => {
    const category = categoryOf(domain);
    return {
      period,
      granularity,
      domain,
      category,
      productivity: categoryProductivityOf(category, settings.categoryProductivity, settings.customCategories),
      activeSeconds: active,
      activeHm: hm(active),
      audioSeconds: Math.max(0, audio),
    };
  };

  const rows: ExportRow[] = [];
  for (const s of dailyStats) {
    if (!isWebDomain(s.domain)) continue;
    const active = activeSeconds(s);
    if (active <= 0 && s.audioSeconds <= 0) continue;
    rows.push(rowFor(s.date, 'day', s.domain, active, s.audioSeconds));
  }
  for (const s of monthlyStats) {
    if (!isWebDomain(s.domain)) continue;
    const active = activeSeconds(s);
    if (active <= 0 && s.audioSeconds <= 0) continue;
    rows.push(rowFor(s.month, 'month', s.domain, active, s.audioSeconds));
  }

  rows.sort((a, b) => (a.period === b.period ? a.domain.localeCompare(b.domain) : a.period.localeCompare(b.period)));
  return rows;
}

const CSV_HEADER = ['period', 'granularity', 'domain', 'category', 'productivity', 'active_seconds', 'active_hm', 'audio_seconds'];

/** Rows as CSV: header + one line per row. RFC 4180 escaped, spreadsheet-ready. */
export function exportRowsToCsv(rows: readonly ExportRow[]): string {
  const lines = [CSV_HEADER.join(',')];
  for (const r of rows) {
    lines.push(
      [r.period, r.granularity, csvField(r.domain), csvField(r.category), r.productivity, r.activeSeconds, r.activeHm, r.audioSeconds].join(','),
    );
  }
  return lines.join('\r\n');
}

/** Rows as JSON: `{ app, exportedAt, rowCount, rows }`. `now` is passed in so this stays pure. */
export function exportRowsToJson(rows: readonly ExportRow[], now: number): string {
  return JSON.stringify({ app: 'tabstyr', exportedAt: new Date(now).toISOString(), rowCount: rows.length, rows }, null, 2);
}
