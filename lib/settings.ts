import { browser } from 'wxt/browser';
import { isCategory, type Category, type CategoryRule } from './categories';
import type { Settings } from './types';

// Guardrails so a corrupt or hostile stored value can't bloat memory or break the UI.
const MAX_RULES = 100;
const MAX_PATTERN_LEN = 100;
const MAX_OVERRIDES = 5_000;
const MAX_DOMAIN_LEN = 253;

export const DEFAULT_SETTINGS: Settings = {
  staleDays: 3,
  // 3 minutes: long enough that reading without mouse/keyboard input still counts,
  // short enough that walking away isn't over-counted by much. User-adjustable.
  idleSeconds: 180,
  audioEnabled: true,
  theme: 'system',
  categoryOverrides: {},
  categoryRules: [],
  onboarded: false,
  language: 'auto',
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function sanitizeOverrides(raw: unknown): Record<string, Category> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, Category> = {};
  let count = 0;
  for (const [domain, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof domain === 'string' && domain && domain.length <= MAX_DOMAIN_LEN && isCategory(value)) {
      out[domain] = value;
      if (++count >= MAX_OVERRIDES) break; // cap so a crafted file can't bloat storage
    }
  }
  return out;
}

function sanitizeRules(raw: unknown): CategoryRule[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: CategoryRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { pattern, category } = item as Record<string, unknown>;
    if (typeof pattern !== 'string' || !isCategory(category)) continue;
    const trimmed = pattern.trim().toLowerCase().slice(0, MAX_PATTERN_LEN);
    if (!trimmed || seen.has(trimmed)) continue; // drop blanks and duplicates
    seen.add(trimmed);
    out.push({ pattern: trimmed, category });
    if (out.length >= MAX_RULES) break;
  }
  return out;
}

function coerce(raw: unknown): Partial<Settings> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const overrides = sanitizeOverrides(r.categoryOverrides);
  const rules = sanitizeRules(r.categoryRules);
  return {
    ...(typeof r.staleDays === 'number' && { staleDays: clamp(r.staleDays, 1, 60) }),
    ...(typeof r.idleSeconds === 'number' && { idleSeconds: clamp(r.idleSeconds, 15, 600) }),
    ...(typeof r.audioEnabled === 'boolean' && { audioEnabled: r.audioEnabled }),
    ...((r.theme === 'system' || r.theme === 'dark' || r.theme === 'light') && { theme: r.theme }),
    ...(overrides && { categoryOverrides: overrides }),
    ...(rules && { categoryRules: rules }),
    ...(typeof r.onboarded === 'boolean' && { onboarded: r.onboarded }),
    ...(typeof r.language === 'string' && { language: r.language.slice(0, 20) }),
  };
}

// In-process cache. The background worker calls getSettings() on every heartbeat
// (and inside audio sync), so an uncached read meant two storage.local round-trips
// per minute. The cache is invalidated by saveSettings (same context) and via
// invalidateSettings() when a 'settings-changed' message arrives from another
// context (the dashboard saving). Treat the returned object as READ-ONLY.
let cache: Settings | null = null;

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
