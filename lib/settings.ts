import { browser } from 'wxt/browser';
import { isCategory, type Category, type CategoryRule } from './categories';
import type { Settings } from './types';

// Guardrails so a corrupt or hostile stored value can't bloat memory or break the UI.
const MAX_RULES = 100;
const MAX_PATTERN_LEN = 100;

export const DEFAULT_SETTINGS: Settings = {
  staleDays: 3,
  idleSeconds: 60,
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
  for (const [domain, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof domain === 'string' && domain && isCategory(value)) out[domain] = value;
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

export async function getSettings(): Promise<Settings> {
  const { settings } = await browser.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...coerce(settings) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await browser.storage.local.set({ settings: next });
  return next;
}
