import { activeSeconds } from './metrics';
import { isWebDomain } from './domain';
import { categorize, type Category, type CategoryRule, type CategorySlice } from './categories';
import type { DailyStat } from './types';

// Builds a per-site activity report over a date range, plus CSV serialization.
// Pure (no DOM, no clock): the report card renderer and CSV/PNG exporters consume
// this. Uses ACTIVE foreground seconds (audio excluded) — the honest, billable
// number — and works for a single day (from === to) or any range, which is what the
// project/client invoicing feature builds on.

export interface ReportDomain {
  domain: string;
  seconds: number; // active foreground seconds over the range
  category: Category;
}

export interface ReportData {
  from: string;
  to: string;
  /** Inclusive calendar-day span of the range (≥ 1). */
  days: number;
  totalSeconds: number; // active foreground total
  categories: CategorySlice[]; // active seconds per category, desc
  domains: ReportDomain[]; // active seconds per domain, desc
}

/** Inclusive day count between two YYYY-MM-DD keys (1 for a single day, 0 if reversed). */
function daySpan(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * Aggregate active per-domain time across [from, to] (inclusive), grouped by domain
 * and by category. Web domains only. `stats` are the raw daily rows; active time
 * (seconds − audioSeconds) is summed so audio never inflates a billable report.
 */
export function buildReport(
  stats: DailyStat[],
  from: string,
  to: string,
  overrides: Record<string, Category> = {},
  rules: readonly CategoryRule[] = [],
): ReportData {
  const byDomain = new Map<string, number>();
  for (const s of stats) {
    if (s.date < from || s.date > to || !isWebDomain(s.domain)) continue;
    const active = activeSeconds(s);
    if (active <= 0) continue;
    byDomain.set(s.domain, (byDomain.get(s.domain) ?? 0) + active);
  }

  const domains: ReportDomain[] = [...byDomain.entries()]
    .map(([domain, seconds]) => ({ domain, seconds, category: categorize(domain, overrides, rules) }))
    .sort((a, b) => b.seconds - a.seconds);

  const catMap = new Map<Category, number>();
  let totalSeconds = 0;
  for (const d of domains) {
    catMap.set(d.category, (catMap.get(d.category) ?? 0) + d.seconds);
    totalSeconds += d.seconds;
  }
  const categories: CategorySlice[] = [...catMap.entries()]
    .map(([category, seconds]) => ({ category, seconds, audioSeconds: 0 }))
    .sort((a, b) => b.seconds - a.seconds);

  return { from, to, days: daySpan(from, to), totalSeconds, categories, domains };
}

/** Escape one CSV field per RFC 4180 (quote when it contains "," / quote / newline). */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Report as CSV: a header row then one row per domain (domain, category, active
 * seconds, H:MM). Deterministic and spreadsheet-ready; no locale formatting so the
 * numeric column stays machine-parseable.
 */
export function reportCsv(report: ReportData): string {
  const hm = (secs: number) => {
    const m = Math.round(secs / 60);
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  };
  const rows = [['domain', 'category', 'active_seconds', 'active_hm'].join(',')];
  for (const d of report.domains) {
    rows.push([csvField(d.domain), csvField(d.category), d.seconds, hm(d.seconds)].join(','));
  }
  rows.push(['TOTAL', '', report.totalSeconds, hm(report.totalSeconds)].map(csvField).join(','));
  return rows.join('\r\n');
}
