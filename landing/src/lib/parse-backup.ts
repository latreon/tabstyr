// Landing-only backup parser for the Browsing Wrapped tool. Mirrors the extension's
// lib/restore.ts validation, but WITHOUT the IndexedDB/settings (wxt) coupling —
// the public site only ever READS a dropped file to compute a Wrapped, never writes.
// Every record is treated as untrusted: malformed rows are dropped, insane values
// clamped, oversized files refused.

import { domainOf, isWebDomain, pageOf } from '@ext/domain';
import { SCHEMA_VERSION } from '@ext/export';
import { isCategory, isProductivity, type CategoryId, type CategoryRule, type CustomCategory } from '@ext/categories';
import type { DailyStat, Session } from '@ext/types';

export interface ParsedBackup {
  dailyStats: DailyStat[];
  sessions: Session[];
  settings?: Record<string, unknown>;
  exportedAt?: string;
}

// Hard caps — a legitimate 90-day backup is far below these; they bound memory and
// parse cost against a crafted file.
const MAX_STATS = 200_000;
const MAX_SESSIONS = 1_000_000;
const MAX_SETTINGS_KEYS = 1_000;
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TS = 4_102_444_800_000; // ~year 2100 (ms)
const MAX_DURATION_MS = 24 * 60 * 60_000;
const MAX_DAY_SECONDS = 90_000;
const MAX_URL_LEN = 4_096;
const MAX_KEY_LEN = 256;
const MAX_RULES = 100;
const MAX_PATTERN_LEN = 100;
const MAX_OVERRIDES = 5_000;
const MAX_DOMAIN_LEN = 253;
const MAX_CUSTOM_CATEGORIES = 20;
const MAX_CAT_NAME_LEN = 24;
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

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
    (o.tabKey === undefined || isBoundedStr(o.tabKey, MAX_KEY_LEN))
  );
}

function safeSettings(v: unknown): Record<string, unknown> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  return Object.keys(v as object).length <= MAX_SETTINGS_KEYS ? (v as Record<string, unknown>) : undefined;
}

function isExportedAt(v: unknown): v is string {
  if (!isStr(v) || v.length > 40) return false;
  return Number.isFinite(Date.parse(v));
}

/** Validate + parse a backup JSON string. Throws human-readable errors for the
 * common failure cases; drops malformed records otherwise. */
export function parseBackup(text: string): ParsedBackup {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('Backup file is too large.');
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(text);
  } catch {
    throw new Error('Not a valid JSON file.');
  }
  if (!o || o.app !== 'tabstyr') throw new Error('Not a TabStyr backup file.');
  const fileVersion = o.schemaVersion;
  if (typeof fileVersion === 'number' && fileVersion > SCHEMA_VERSION) {
    throw new Error('This backup was made by a newer version of TabStyr. Please update first.');
  }
  return {
    dailyStats: Array.isArray(o.dailyStats) ? o.dailyStats.filter(isStat).slice(0, MAX_STATS) : [],
    // Re-derive `domain` from the normalized url so a crafted backup can't pair a
    // spoofed domain with an unrelated url (isSession validates them independently).
    sessions: Array.isArray(o.sessions)
      ? o.sessions
          .filter(isSession)
          .slice(0, MAX_SESSIONS)
          .map((s) => {
            const url = pageOf(s.url);
            return { ...s, url, domain: domainOf(url), tabKey: s.tabKey ?? '' };
          })
          .filter((s) => isWebDomain(s.domain))
      : [],
    settings: safeSettings(o.settings),
    exportedAt: isExportedAt(o.exportedAt) ? o.exportedAt : undefined,
  };
}

// User-added categories, mirroring the extension's lib/settings.ts sanitization:
// keep only well-formed entries — a non-empty name that doesn't collide with a
// built-in nor with an earlier custom (case-insensitive), a valid hex color, and a
// valid productivity. Cap the count so a crafted file can't bloat memory.
function sanitizeCustomCategories(raw: unknown): CustomCategory[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CustomCategory[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { name, color, productivity } = item as Record<string, unknown>;
    if (typeof name !== 'string' || typeof color !== 'string') continue;
    const trimmed = name.trim().slice(0, MAX_CAT_NAME_LEN);
    const key = trimmed.toLowerCase();
    if (!trimmed || isCategory(trimmed) || seen.has(key)) continue;
    if (!HEX_COLOR.test(color)) continue;
    seen.add(key);
    out.push({
      name: trimmed,
      color: color.toLowerCase(),
      productivity: isProductivity(productivity) ? productivity : 'neutral',
    });
    if (out.length >= MAX_CUSTOM_CATEGORIES) break;
  }
  return out;
}

/** Pull the user's category config out of an untrusted settings blob, sanitized to
 * the same caps the extension uses, so Wrapped categorizes exactly like the dashboard.
 * Overrides/rules may point at a built-in OR at one of the (sanitized) custom
 * category names — anything else is dropped. */
export function sanitizeCategoryConfig(raw: unknown): {
  overrides: Record<string, CategoryId>;
  rules: CategoryRule[];
  customCategories: CustomCategory[];
} {
  const overrides: Record<string, CategoryId> = {};
  const rules: CategoryRule[] = [];
  if (!raw || typeof raw !== 'object') return { overrides, rules, customCategories: [] };
  const r = raw as Record<string, unknown>;

  const customCategories = sanitizeCustomCategories(r.customCategories);
  const customNames = new Set(customCategories.map((c) => c.name));
  const isValidCategory = (v: unknown): v is CategoryId =>
    typeof v === 'string' && (isCategory(v) || customNames.has(v));

  if (r.categoryOverrides && typeof r.categoryOverrides === 'object') {
    let count = 0;
    for (const [domain, value] of Object.entries(r.categoryOverrides as Record<string, unknown>)) {
      if (typeof domain === 'string' && domain && domain.length <= MAX_DOMAIN_LEN && isValidCategory(value)) {
        overrides[domain] = value;
        if (++count >= MAX_OVERRIDES) break;
      }
    }
  }

  if (Array.isArray(r.categoryRules)) {
    const seen = new Set<string>();
    for (const item of r.categoryRules) {
      if (!item || typeof item !== 'object') continue;
      const { pattern, category } = item as Record<string, unknown>;
      if (typeof pattern !== 'string' || !isValidCategory(category)) continue;
      const trimmed = pattern.trim().toLowerCase().slice(0, MAX_PATTERN_LEN);
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      rules.push({ pattern: trimmed, category });
      if (rules.length >= MAX_RULES) break;
    }
  }
  return { overrides, rules, customCategories };
}
