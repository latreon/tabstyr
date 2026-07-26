import { browser } from 'wxt/browser';
import {
  CATEGORIES,
  CATEGORY_PRODUCTIVITY,
  isCategory,
  isProductivity,
  type Category,
  type CategoryId,
  type CategoryRule,
  type CustomCategory,
  type Productivity,
} from './categories';
import type { Settings } from './types';

// Guardrails so a corrupt or hostile stored value can't bloat memory or break the UI.
const MAX_RULES = 100;
const MAX_PATTERN_LEN = 100;
const MAX_OVERRIDES = 5_000;
const MAX_DOMAIN_LEN = 253;
const MAX_CUSTOM_CATEGORIES = 20;
const MAX_CAT_NAME_LEN = 24;
const MAX_SESSION_ALERT_MINUTES = 180;
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const DEFAULT_SETTINGS: Settings = {
  staleDays: 3,
  // 3 minutes: long enough that reading without mouse/keyboard input still counts,
  // short enough that walking away isn't over-counted by much. User-adjustable.
  idleSeconds: 180,
  audioEnabled: true,
  theme: 'system',
  customCategories: [],
  categoryOverrides: {},
  categoryRules: [],
  categoryProductivity: { ...CATEGORY_PRODUCTIVITY },
  focusTarget: 50,
  categoryBudgets: {},
  onboarded: false,
  notificationsEnabled: true,
  // 30 min: long enough to not nag over a quick check, short enough to catch a
  // doomscroll before it eats an hour. 0 = off.
  sessionAlertMinutes: 30,
  language: 'auto',
  autoExportDays: 0,
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// A usable numeric setting. `typeof v === 'number'` alone lets NaN/Infinity through,
// and clamp() is NaN-transparent (Math.min/max propagate it), so a corrupt value
// would survive sanitization and reach consumers (e.g. idle.setDetectionInterval).
// Rejecting them here makes the field fall back to its DEFAULT_SETTINGS value.
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// User-added categories. Keep only well-formed entries: a non-empty name that
// doesn't collide with a built-in (add-only — built-ins are reserved) nor with an
// earlier custom (case-insensitive), a valid hex color, and a valid productivity.
// Cap the count so a crafted file can't bloat storage.
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

// A category VALUE is valid if it's a built-in or one of the (already-sanitized)
// custom category names. Overrides/rules may point at either.
function makeIsValidCategory(custom: readonly CustomCategory[]): (v: unknown) => v is CategoryId {
  const names = new Set(custom.map((c) => c.name));
  return (v: unknown): v is CategoryId => typeof v === 'string' && (isCategory(v) || names.has(v));
}

function sanitizeOverrides(
  raw: unknown,
  isValid: (v: unknown) => v is CategoryId,
): Record<string, CategoryId> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, CategoryId> = {};
  let count = 0;
  for (const [domain, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof domain === 'string' && domain && domain.length <= MAX_DOMAIN_LEN && isValid(value)) {
      out[domain] = value;
      if (++count >= MAX_OVERRIDES) break; // cap so a crafted file can't bloat storage
    }
  }
  return out;
}

function sanitizeRules(
  raw: unknown,
  isValid: (v: unknown) => v is CategoryId,
): CategoryRule[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: CategoryRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { pattern, category } = item as Record<string, unknown>;
    if (typeof pattern !== 'string' || !isValid(category)) continue;
    const trimmed = pattern.trim().toLowerCase().slice(0, MAX_PATTERN_LEN);
    if (!trimmed || seen.has(trimmed)) continue; // drop blanks and duplicates
    seen.add(trimmed);
    out.push({ pattern: trimmed, category });
    if (out.length >= MAX_RULES) break;
  }
  return out;
}

// Always return a COMPLETE mapping: start from the default and overlay only valid
// (known category → valid productivity) entries. This way a partial/corrupt stored
// value can never leave a category undefined (which would break focus math), and a
// newly added category automatically gets its default classification.
function sanitizeProductivity(raw: unknown): Record<Category, Productivity> {
  const out: Record<Category, Productivity> = { ...CATEGORY_PRODUCTIVITY };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const c of CATEGORIES) {
    if (isProductivity(r[c])) out[c] = r[c] as Productivity;
  }
  return out;
}

// Per-category daily budgets in minutes. Keep only known categories (built-in or
// sanitized custom name) with a positive, sane integer minute value (≤ 24h); drop
// everything else so a crafted value can't inject junk keys or absurd numbers.
// Because validity is checked against the already-sanitized custom list, deleting
// a custom category automatically drops its budget on the next save/read.
const MAX_BUDGET_MINUTES = 24 * 60;
function sanitizeBudgets(
  raw: unknown,
  isValid: (v: unknown) => v is CategoryId,
): Partial<Record<CategoryId, number>> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<Record<CategoryId, number>> = {};
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isValid(key)) continue;
    if (isNum(v) && v > 0) {
      out[key] = clamp(Math.round(v), 1, MAX_BUDGET_MINUTES);
    }
  }
  return out;
}

function coerce(raw: unknown): Partial<Settings> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const customCategories = sanitizeCustomCategories(r.customCategories);
  const isValid = makeIsValidCategory(customCategories);
  const overrides = sanitizeOverrides(r.categoryOverrides, isValid);
  const rules = sanitizeRules(r.categoryRules, isValid);
  return {
    // Rounded like every other numeric setting: both are consumed as whole units
    // (days for stale detection, integer seconds by idle.setDetectionInterval, which
    // rejects a fractional argument), so a hand-edited backup can't smuggle 15.5 in.
    ...(isNum(r.staleDays) && { staleDays: clamp(Math.round(r.staleDays), 1, 60) }),
    ...(isNum(r.idleSeconds) && { idleSeconds: clamp(Math.round(r.idleSeconds), 15, 600) }),
    ...(typeof r.audioEnabled === 'boolean' && { audioEnabled: r.audioEnabled }),
    ...((r.theme === 'system' || r.theme === 'dark' || r.theme === 'light') && { theme: r.theme }),
    customCategories,
    ...(overrides && { categoryOverrides: overrides }),
    ...(rules && { categoryRules: rules }),
    // Always a full, valid mapping (missing/invalid entries fall back to default).
    categoryProductivity: sanitizeProductivity(r.categoryProductivity),
    ...(isNum(r.focusTarget) && { focusTarget: clamp(Math.round(r.focusTarget), 10, 90) }),
    categoryBudgets: sanitizeBudgets(r.categoryBudgets, isValid),
    ...(typeof r.onboarded === 'boolean' && { onboarded: r.onboarded }),
    ...(typeof r.notificationsEnabled === 'boolean' && { notificationsEnabled: r.notificationsEnabled }),
    ...(isNum(r.sessionAlertMinutes) && { sessionAlertMinutes: clamp(Math.round(r.sessionAlertMinutes), 0, MAX_SESSION_ALERT_MINUTES) }),
    ...(typeof r.language === 'string' && { language: r.language.slice(0, 20) }),
    ...(isNum(r.autoExportDays) && { autoExportDays: r.autoExportDays <= 0 ? 0 : clamp(Math.round(r.autoExportDays), 1, 365) }),
  };
}

// In-process cache. The background worker calls getSettings() on every heartbeat
// (and inside audio sync), so an uncached read meant two storage.local round-trips
// per minute. The cache is invalidated by saveSettings (same context) and via
// invalidateSettings() when a 'settings-changed' message arrives from another
// context (the dashboard saving). Treat the returned object as READ-ONLY.
let cache: Settings | null = null;
// Serialized form of the last value THIS context wrote, so the storage listener
// below can tell our own write apart from another context's.
let lastWritten: string | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache) return cache;
  const { settings } = await browser.storage.local.get('settings');
  cache = { ...DEFAULT_SETTINGS, ...coerce(settings) };
  return cache;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  // Sanitize the MERGED result before persisting — never write a raw patch. A
  // hostile/oversized value (e.g. from an imported backup) is clamped/dropped here
  // rather than only when read back, so it can't bloat or corrupt stored settings.
  const next = { ...DEFAULT_SETTINGS, ...coerce({ ...(await getSettings()), ...patch }) };
  lastWritten = JSON.stringify(next);
  await browser.storage.local.set({ settings: next });
  cache = next;
  return next;
}

/** Drop the cache so the next getSettings() re-reads from storage. Call when
 * settings may have changed in another context (e.g. on a settings-changed
 * message in the background worker). */
export function invalidateSettings(): void {
  cache = null;
}

/**
 * Drop this context's cache whenever ANOTHER context writes settings.
 *
 * Every context (popup, each dashboard tab, the worker) caches settings in module
 * scope, and saveSettings merges its patch onto that cache. Without this listener a
 * second page held a stale snapshot and its next save silently reverted the first
 * page's changes — e.g. change the focus target in the dashboard, then toggle the
 * theme in the popup, and the focus target came back. Invalidating on every foreign
 * write makes the next save merge onto current data instead.
 *
 * Own writes are skipped (the value we just stored is identical) so the common path
 * does no extra storage round-trip. Registration is best-effort: a runtime without
 * storage.onChanged simply keeps the previous single-context behaviour.
 *
 * Called once on import. Exported so tests can re-register after resetting their
 * fake browser (which drops all listeners); the handler is idempotent, so an extra
 * registration only ever clears an already-cleared cache.
 */
export function syncSettingsAcrossContexts(): void {
  try {
    browser.storage?.onChanged?.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes.settings) return;
      if (JSON.stringify(changes.settings.newValue ?? null) === lastWritten) return;
      cache = null;
    });
  } catch {
    /* storage.onChanged unavailable — cache stays context-local */
  }
}
syncSettingsAcrossContexts();

/**
 * Tell the other contexts (chiefly the background worker) that settings changed, so
 * they drop their cache. Fire-and-forget: a missing receiver is not an error the
 * caller should surface, and reporting one made a successful save look failed.
 *
 * Required after ANY page-side saveSettings — the worker reads settings on every
 * heartbeat (notification language, idle interval, category classification, budgets)
 * and on Firefox its background page is persistent, so a stale cache never expires
 * on its own.
 */
export async function broadcastSettingsChanged(): Promise<void> {
  try {
    await browser.runtime.sendMessage({ type: 'settings-changed' });
  } catch {
    /* no receiver (worker asleep / page-only context) — it re-reads on next start */
  }
}
