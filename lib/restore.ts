import * as repo from './db/repo';
import { SCHEMA_VERSION } from './export';
import { saveSettings } from './settings';
import { isWebDomain, pageOf } from './domain';
import type { DailyStat, Session, Settings, TabMeta } from './types';

export interface ParsedBackup {
  dailyStats: DailyStat[];
  sessions: Session[];
  tabMeta: TabMeta[];
  settings?: Record<string, unknown>;
  exportedAt?: string;
}

// Hard caps on imported record counts — a legitimate 90-day backup is far below
// these; the limits stop a crafted file from exhausting memory / IndexedDB and
// dying mid-restore (which wipes existing data first).
const MAX_STATS = 200_000;
const MAX_SESSIONS = 1_000_000;
const MAX_TABMETA = 20_000;
const MAX_SETTINGS_KEYS = 1_000;

// Reject an oversized file before reading/parsing it — a multi-hundred-MB JSON
// would freeze the main thread in JSON.parse() long before the per-record caps
// above could apply. A real 90-day backup is a few MB at most; 64 MB is a
// generous ceiling that still bounds memory/parse cost.
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;

// Value sanity bounds. Imported data is untrusted: impossible values (negative
// durations, end<start, audio>total, far-future timestamps) would silently
// corrupt dashboard math, so drop any record that violates them.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TS = 4_102_444_800_000; // ~year 2100 (ms) — anything beyond is bogus
const MAX_DURATION_MS = 24 * 60 * 60_000; // a single session can't exceed a day
const MAX_DAY_SECONDS = 90_000; // per-domain per-day ceiling (>24h headroom)
const MAX_URL_LEN = 4_096;
const MAX_TITLE_LEN = 2_048;
const MAX_KEY_LEN = 256;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isBoundedStr = (v: unknown, max: number): v is string => isStr(v) && v.length <= max;
const isTs = (v: unknown): v is number => isNum(v) && v > 0 && v < MAX_TS;

function isStat(v: unknown): v is DailyStat {
  const o = v as DailyStat;
  return (
    !!o &&
    isBoundedStr(o.date, 10) && DATE_RE.test(o.date) &&
    isBoundedStr(o.domain, MAX_KEY_LEN) && isWebDomain(o.domain) &&
    isNum(o.seconds) && o.seconds >= 0 && o.seconds <= MAX_DAY_SECONDS &&
    isNum(o.audioSeconds) && o.audioSeconds >= 0 && o.audioSeconds <= o.seconds
  );
}
function isSession(v: unknown): v is Session {
  const o = v as Session;
  return (
    !!o &&
    isBoundedStr(o.domain, MAX_KEY_LEN) && isWebDomain(o.domain) &&
    isBoundedStr(o.url, MAX_URL_LEN) &&
    isTs(o.start) && isTs(o.end) && o.start < o.end && o.end - o.start <= MAX_DURATION_MS &&
    typeof o.audio === 'boolean' &&
    // tabKey is the per-tab attribution id. Legacy files may omit it (normalized
    // to '' below); reject any non-string value so a hostile null/number can't
    // reach the IndexedDB by-key index.
    (o.tabKey === undefined || isBoundedStr(o.tabKey, MAX_KEY_LEN))
  );
}
function isMeta(v: unknown): v is TabMeta {
  const o = v as TabMeta;
  return (
    !!o && isNum(o.tabId) &&
    isBoundedStr(o.key, MAX_KEY_LEN) && isBoundedStr(o.url, MAX_URL_LEN) &&
    isBoundedStr(o.title, MAX_TITLE_LEN) && isTs(o.lastActiveAt) && isTs(o.createdAt) &&
    (o.snoozedUntil === undefined || isTs(o.snoozedUntil))
  );
}
// Accept only a plausible ISO-ish timestamp string that parses to a real date.
function isExportedAt(v: unknown): v is string {
  if (!isStr(v) || v.length > 40) return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}
// Reject a settings object with an absurd key count before coerce() iterates it.
function safeSettings(v: unknown): Record<string, unknown> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  return Object.keys(v as object).length <= MAX_SETTINGS_KEYS ? (v as Record<string, unknown>) : undefined;
}

/**
 * Validate and parse a (decrypted) backup JSON string. Untrusted input — every
 * record is filtered to a well-formed shape, malformed rows are dropped.
 */
export function parseBackup(text: string): ParsedBackup {
  // Defense in depth — the UI rejects by file.size first, but a decrypted payload
  // arrives here as a raw string. Bound it before JSON.parse() touches it.
  if (text.length > MAX_BACKUP_BYTES) throw new Error('Backup file is too large.');
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(text);
  } catch {
    throw new Error('Not a valid JSON file.');
  }
  if (!o || o.app !== 'tabstyr') throw new Error('Not a TabStyr backup file.');
  // Forward-compat guard: a file stamped with a newer schema than this build
  // understands may have a different shape — silently importing it would drop or
  // mangle records. Refuse with a clear message. (Missing/legacy versions, ≤ the
  // supported version, fall through to the tolerant per-record validators below.)
  const fileVersion = o.schemaVersion;
  if (typeof fileVersion === 'number' && fileVersion > SCHEMA_VERSION) {
    throw new Error('This backup was made by a newer version of TabStyr. Please update first.');
  }
  return {
    dailyStats: Array.isArray(o.dailyStats) ? o.dailyStats.filter(isStat).slice(0, MAX_STATS) : [],
    // Re-normalize urls on import: a backup from an older build may carry raw
    // query/fragment values — strip them so restored data also holds no tokens.
    sessions: Array.isArray(o.sessions)
      ? o.sessions
          .filter(isSession)
          .slice(0, MAX_SESSIONS)
          .map((s) => ({ ...s, url: pageOf(s.url), tabKey: s.tabKey ?? '' }))
      : [],
    tabMeta: Array.isArray(o.tabMeta)
      ? o.tabMeta.filter(isMeta).slice(0, MAX_TABMETA).map((m) => ({ ...m, url: pageOf(m.url) }))
      : [],
    settings: safeSettings(o.settings),
    exportedAt: isExportedAt(o.exportedAt) ? o.exportedAt : undefined,
  };
}

export interface RestoreResult {
  dailyStats: number;
  sessions: number;
  tabMeta: number;
}

/**
 * Replace all stored data with the backup's contents. Destructive — the caller
 * must confirm with the user first. Settings are re-saved (and re-sanitized) so
 * a hostile file can't inject invalid settings.
 */
export async function restoreBackup(parsed: ParsedBackup): Promise<RestoreResult> {
  // Strip any reactive (Vue) proxy: IndexedDB's structured clone cannot clone a
  // Proxy, and callers often hold `parsed` in a ref. A JSON round-trip yields
  // plain, structured-cloneable objects (all fields are JSON-serializable).
  const data: ParsedBackup = JSON.parse(JSON.stringify(parsed));
  // Clear + write all three stores in a SINGLE transaction: a failure aborts the
  // whole restore and rolls back the clears, so existing history is never lost to
  // a half-completed import (see repo.restoreAll).
  await repo.restoreAll(data.sessions, data.dailyStats, data.tabMeta);
  // getSettings() re-sanitizes on the next read, so unsafe fields can't survive.
  if (data.settings) await saveSettings(data.settings as Partial<Settings>);
  return {
    dailyStats: data.dailyStats.length,
    sessions: data.sessions.length,
    tabMeta: data.tabMeta.length,
  };
}
