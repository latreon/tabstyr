import { domainOf, isWebDomain } from './domain';
import type { DailyStat } from './types';

// Tolerant CSV importer for seeding day-1 data from another time tracker (e.g. a
// RescueTime export). Pure — no DOM, no clock. Untrusted input: every row is
// validated and clamped, non-web activities are dropped, and per-(date, domain)
// values are capped, so a malformed or hostile file can't corrupt dashboard math.
// Imported time is an ESTIMATE and callers should label it as such.

const MAX_ROWS = 500_000; // bound parse cost on a crafted file
const MAX_DAY_SECONDS = 90_000; // per-domain per-day ceiling (matches restore.ts)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface CsvImportResult {
  stats: DailyStat[]; // aggregated per (date, domain), ready to merge
  imported: number; // rows that produced usable data
  skipped: number; // rows dropped (non-web, bad date, zero/negative time)
}

/** Split one CSV line into fields, honoring double-quoted fields with embedded commas. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(field); field = ''; }
    else field += ch;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

/**
 * Claim the best-matching header column for a role, never reusing one already
 * claimed. Exact header names win over substrings, and needles are tried in
 * priority order, because plain `includes` misfired in both directions: 'day'
 * matched a "Monday" column, and a single "DateTime" column satisfied both the date
 * and the duration role — so every row was then parsed with the date as its
 * duration and silently skipped. Claiming makes that a clear "columns" error instead.
 */
function findCol(header: string[], needles: string[], claimed: Set<number>): number {
  const free = (i: number) => i >= 0 && !claimed.has(i);
  for (const n of needles) {
    const exact = header.findIndex((h, i) => free(i) && h === n);
    if (exact >= 0) return exact;
  }
  for (const n of needles) {
    const partial = header.findIndex((h, i) => free(i) && h.includes(n));
    if (partial >= 0) return partial;
  }
  return -1;
}

/**
 * Extract a web host from an activity cell. `domainOf` needs a scheme, so a bare
 * host ("github.com") is retried with an https:// prefix. Returns '' when the cell
 * isn't a web host (e.g. "Microsoft Word") so the caller can skip it.
 */
function extractDomain(raw: string): string {
  const v = raw.toLowerCase().trim();
  if (!v) return '';
  const direct = domainOf(v);
  if (isWebDomain(direct)) return direct;
  const prefixed = domainOf(`https://${v}`);
  return isWebDomain(prefixed) ? prefixed : '';
}

/** Normalize a cell to a YYYY-MM-DD local date key, or null if unparseable. */
function toDateKey(raw: string): string | null {
  if (DATE_RE.test(raw)) return raw;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Parse a time-tracker CSV into aggregated daily per-domain stats. Recognizes a
 * date column, a domain/activity/site column, and a duration column whose unit is
 * inferred from its header (seconds / minutes / hours; defaults to seconds).
 * Throws a tagged Error ('empty' | 'columns') the UI maps to a localized message.
 */
export function parseCsvImport(text: string): CsvImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) throw new Error('empty');

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  // Claim in order of how specific the needles are, so the greediest role ('time')
  // can't steal a column another role needs more.
  const claimed = new Set<number>();
  const claim = (needles: string[]): number => {
    const i = findCol(header, needles, claimed);
    if (i >= 0) claimed.add(i);
    return i;
  };
  const timeIdx = claim(['seconds', 'minutes', 'hours', 'duration', 'second', 'minute', 'hour', 'time spent', 'time']);
  const dateIdx = claim(['date', 'day']);
  const domainIdx = claim(['domain', 'activity', 'site', 'host', 'url']);
  if (dateIdx < 0 || domainIdx < 0 || timeIdx < 0) throw new Error('columns');

  const unitHeader = header[timeIdx];
  const unit = unitHeader.includes('hour') ? 3600 : unitHeader.includes('minute') ? 60 : 1;

  const byKey = new Map<string, DailyStat>();
  let imported = 0;
  let skipped = 0;
  const rows = Math.min(lines.length - 1, MAX_ROWS);
  for (let i = 1; i <= rows; i++) {
    const cols = splitLine(lines[i]);
    const date = toDateKey(cols[dateIdx] ?? '');
    const domain = extractDomain(cols[domainIdx] ?? '');
    const value = Number(cols[timeIdx]);
    if (!date || !domain || !Number.isFinite(value) || value <= 0) {
      skipped++;
      continue;
    }
    const seconds = Math.round(value * unit);
    if (seconds <= 0) { skipped++; continue; }
    const key = `${date}|${domain}`;
    const cur = byKey.get(key) ?? { date, domain, seconds: 0, audioSeconds: 0 };
    cur.seconds = Math.min(MAX_DAY_SECONDS, cur.seconds + seconds);
    byKey.set(key, cur);
    imported++;
  }

  return { stats: [...byKey.values()], imported, skipped };
}
