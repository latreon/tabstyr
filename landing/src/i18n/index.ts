import { shallowRef } from 'vue';
import { SITE_URL } from '@/site';
import en from './locales/en.json';

// ── Supported languages ──────────────────────────────────────────────────────
// Mirrors the 11 locales the extension already ships. `label` is the language in
// its own script; `flag` a regional-indicator emoji; `slug` the URL prefix
// (English is the un-prefixed root); `hreflang` the BCP-47 tag for SEO alternates.
export interface Locale {
  code: string;
  label: string;
  flag: string;
  slug: string; // '' for the default (English) — served at the site root
  hreflang: string;
}

export const LOCALES: readonly Locale[] = [
  { code: 'en', label: 'English', flag: '🇬🇧', slug: '', hreflang: 'en' },
  { code: 'es', label: 'Español', flag: '🇪🇸', slug: 'es', hreflang: 'es' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', slug: 'de', hreflang: 'de' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', slug: 'fr', hreflang: 'fr' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹', slug: 'it', hreflang: 'it' },
  { code: 'pt-BR', label: 'Português (BR)', flag: '🇧🇷', slug: 'pt-br', hreflang: 'pt-BR' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺', slug: 'ru', hreflang: 'ru' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷', slug: 'tr', hreflang: 'tr' },
  { code: 'ja', label: '日本語', flag: '🇯🇵', slug: 'ja', hreflang: 'ja' },
  { code: 'ko', label: '한국어', flag: '🇰🇷', slug: 'ko', hreflang: 'ko' },
  { code: 'zh-CN', label: '中文（简体）', flag: '🇨🇳', slug: 'zh-cn', hreflang: 'zh-CN' },
] as const;

export type Messages = typeof en;
export const DEFAULT_LOCALE = 'en';
const CACHE_KEY = 'tabstyr:lang';
const BASE = import.meta.env.BASE_URL; // '/' on the custom domain

// Lazy message loaders — Vite splits each into its own chunk, so a visitor only
// downloads the locale they actually view. English is bundled eagerly (fallback).
const loaders: Record<string, () => Promise<{ default: Messages }>> = {
  es: () => import('./locales/es.json'),
  de: () => import('./locales/de.json'),
  fr: () => import('./locales/fr.json'),
  it: () => import('./locales/it.json'),
  'pt-BR': () => import('./locales/pt-BR.json'),
  ru: () => import('./locales/ru.json'),
  tr: () => import('./locales/tr.json'),
  ja: () => import('./locales/ja.json'),
  ko: () => import('./locales/ko.json'),
  'zh-CN': () => import('./locales/zh-CN.json'),
};

const cache: Record<string, Messages> = { en };

// Reactive state shared across the whole app (single source of truth).
const locale = shallowRef<string>(DEFAULT_LOCALE);
const messages = shallowRef<Messages>(en);

// ── Slug ⇄ code helpers ──────────────────────────────────────────────────────
export const codeForSlug = (slug: string): string | undefined =>
  LOCALES.find((l) => l.slug === slug.toLowerCase())?.code;
export const localeForCode = (code: string): Locale =>
  LOCALES.find((l) => l.code === code) ?? LOCALES[0];
const isSlug = (seg: string): boolean =>
  seg !== '' && LOCALES.some((l) => l.slug === seg.toLowerCase());

/** Pull a leading locale slug off a path. Returns the matched code (or default)
 * and the remaining route ('', 'privacy', 'ideas'). */
export function splitLocale(path: string): { code: string; rest: string } {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const [first, ...others] = clean.split('/');
  if (isSlug(first)) return { code: codeForSlug(first)!, rest: others.join('/') };
  return { code: DEFAULT_LOCALE, rest: clean };
}

/** Build an absolute or app-relative href for a route in a given locale. */
export function localizedPath(code: string, rest = ''): string {
  const slug = localeForCode(code).slug;
  const tail = rest ? rest.replace(/^\/+/, '') : '';
  const parts = [slug, tail].filter(Boolean).join('/');
  return BASE + parts;
}

/** Best-guess starting locale: stored choice → browser language → English. */
export function preferredLocale(): string {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored && LOCALES.some((l) => l.code === stored)) return stored;
  } catch {
    /* storage blocked — fall through */
  }
  const ui = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  if (LOCALES.some((l) => l.code === ui)) return ui;
  const base = ui.split('-')[0];
  return LOCALES.find((l) => l.code.split('-')[0] === base)?.code ?? DEFAULT_LOCALE;
}

// ── Translation lookup ───────────────────────────────────────────────────────
function getPath(obj: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, seg) => {
    if (acc == null) return undefined;
    return (acc as Record<string, unknown>)[seg];
  }, obj);
}

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** Translate a dot-path key to a string (active locale, falling back to English). */
export function t(key: string, params?: Record<string, string | number>): string {
  const hit = getPath(messages.value, key) ?? getPath(en, key);
  return typeof hit === 'string' ? interpolate(hit, params) : key;
}

/** Return a raw translated branch (array/object) for v-for sections, en-fallback. */
export function tm<T = unknown>(key: string): T {
  return (getPath(messages.value, key) ?? getPath(en, key)) as T;
}

// ── Head / SEO ───────────────────────────────────────────────────────────────
function upsertMeta(selector: string, attrs: Record<string, string>): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
}

function upsertLink(rel: string, href: string, hreflang?: string): HTMLLinkElement {
  const sel = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]`;
  let el = document.head.querySelector<HTMLLinkElement>(sel);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    if (hreflang) el.hreflang = hreflang;
    document.head.appendChild(el);
  }
  el.href = href;
  return el;
}

/** Sync <html lang>, title, description, canonical and hreflang alternates to the
 * active locale + current route. `rest` is the un-prefixed route ('', 'privacy', 'ideas'). */
export function applyHead(rest: string): void {
  const titleKey = rest === 'privacy' ? 'meta.privacyTitle' : rest === 'ideas' ? 'meta.ideasTitle' : 'meta.title';
  const descKey =
    rest === 'privacy' ? 'meta.privacyDescription' : rest === 'ideas' ? 'meta.ideasDescription' : 'meta.description';
  const loc = localeForCode(locale.value);

  document.documentElement.lang = loc.hreflang;
  document.title = t(titleKey);
  upsertMeta('meta[name="description"]', { name: 'description', content: t(descKey) });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: t(titleKey) });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: t('meta.ogDescription') });

  // localizedPath already starts with BASE ('/'), so SITE_URL (no trailing slash) + it = absolute.
  const abs = (code: string): string => SITE_URL + localizedPath(code, rest);
  upsertLink('canonical', abs(locale.value));
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: abs(locale.value) });

  // Refresh hreflang alternates (remove stale ones first, then re-add all).
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((n) => n.remove());
  for (const l of LOCALES) upsertLink('alternate', abs(l.code), l.hreflang);
  upsertLink('alternate', abs(DEFAULT_LOCALE), 'x-default');
}

// ── Locale activation ────────────────────────────────────────────────────────
export async function loadMessages(code: string): Promise<Messages> {
  if (cache[code]) return cache[code];
  const loader = loaders[code];
  if (!loader) return en;
  try {
    const mod = await loader();
    cache[code] = mod.default;
    return mod.default;
  } catch {
    return en; // chunk failed to load — degrade to English rather than break
  }
}

/** Activate a locale: load its messages, flip reactive state, persist the choice. */
export async function setLocale(code: string, persist = true): Promise<void> {
  const next = LOCALES.some((l) => l.code === code) ? code : DEFAULT_LOCALE;
  messages.value = await loadMessages(next);
  locale.value = next;
  if (persist) {
    try {
      localStorage.setItem(CACHE_KEY, next);
    } catch {
      /* storage blocked — choice just won't persist */
    }
  }
}

/** Reactive composable for components. */
export function useI18n() {
  return { t, tm, locale, setLocale, LOCALES };
}

export { locale };
