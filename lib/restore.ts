import * as repo from './db/repo';
import { saveSettings } from './settings';
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

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function isStat(v: unknown): v is DailyStat {
  const o = v as DailyStat;
  return !!o && isStr(o.date) && isStr(o.domain) && isNum(o.seconds) && isNum(o.audioSeconds);
}
function isSession(v: unknown): v is Session {
  const o = v as Session;
  return !!o && isStr(o.domain) && isStr(o.url) && isNum(o.start) && isNum(o.end) && typeof o.audio === 'boolean';
}
function isMeta(v: unknown): v is TabMeta {
  const o = v as TabMeta;
  return (
    !!o && isNum(o.tabId) && isStr(o.key) && isStr(o.url) &&
    isStr(o.title) && isNum(o.lastActiveAt) && isNum(o.createdAt)
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
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(text);
  } catch {
    throw new Error('Not a valid JSON file.');
  }
  if (!o || o.app !== 'tabstyr') throw new Error('Not a TabStyr backup file.');
  return {
    dailyStats: Array.isArray(o.dailyStats) ? o.dailyStats.filter(isStat).slice(0, MAX_STATS) : [],
    sessions: Array.isArray(o.sessions) ? o.sessions.filter(isSession).slice(0, MAX_SESSIONS) : [],
    tabMeta: Array.isArray(o.tabMeta) ? o.tabMeta.filter(isMeta).slice(0, MAX_TABMETA) : [],
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
  await repo.wipeAll();
  await repo.addSessions(data.sessions);
  await repo.applyDailyStats(data.dailyStats); // store is empty post-wipe → deltas become absolute values
  await repo.replaceAllTabMeta(data.tabMeta);
  // getSettings() re-sanitizes on the next read, so unsafe fields can't survive.
  if (data.settings) await saveSettings(data.settings as Partial<Settings>);
  return {
    dailyStats: data.dailyStats.length,
    sessions: data.sessions.length,
    tabMeta: data.tabMeta.length,
  };
}
