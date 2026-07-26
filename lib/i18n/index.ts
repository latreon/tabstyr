import { createI18n } from 'vue-i18n';
import { setDateLocale } from '@/lib/locale';
import en from './locales/en.json';

/** Languages offered in the picker. `label` is shown in the user's own script;
 * `flag` is a regional-indicator emoji shown beside it. */
export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'pt-BR', label: 'Português (BR)', flag: '🇧🇷' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'zh-CN', label: '中文（简体）', flag: '🇨🇳' },
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]['code'];

const CODES = SUPPORTED_LOCALES.map((l) => l.code) as readonly string[];
const CACHE_KEY = 'tabstyr:lang';

/** Resolve a stored preference ('auto' or a code) to a concrete supported locale,
 * falling back through the browser UI language to English. */
export function resolveLocale(pref: string | undefined): LocaleCode {
  if (pref && pref !== 'auto' && CODES.includes(pref)) return pref as LocaleCode;
  const ui = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  if (CODES.includes(ui)) return ui as LocaleCode;
  const base = ui.split('-')[0];
  const hit = CODES.find((c) => c.split('-')[0] === base);
  return (hit ?? 'en') as LocaleCode;
}

/**
 * Mirror the raw language PREFERENCE ('auto' or a code) for the next cold start.
 * It must be the preference, not the resolved locale: caching the resolved code
 * turned 'auto' into a hard-pinned language, so a user on 'auto' who later changed
 * their browser language kept seeing the old one. Written by useLocale, which is
 * the layer that knows the preference; setLocale only ever sees a concrete code.
 */
export function cacheLanguagePref(pref: string): void {
  try {
    localStorage.setItem(CACHE_KEY, pref);
  } catch {
    /* storage unavailable — the preference still applies for this session */
  }
}

function cachedPref(): string | undefined {
  try {
    return localStorage.getItem(CACHE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

// Lazy message loaders — Vite splits each into its own chunk, so only the active
// locale is fetched at runtime. English is bundled eagerly as the default + fallback.
const loaders: Record<string, () => Promise<{ default: typeof en }>> = {
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

/**
 * Russian plural selection. vue-i18n's built-in rule is the Germanic one/other
 * split, so a 2-form Russian message produced "Закрыто 3 вкладок" (the 5+ genitive
 * plural) for counts of 2–4, which are grammatically "3 вкладки".
 *
 * Message shape for Russian plural keys is `zero | one | few | many` (4 forms):
 *   one  → 1, 21, 31 … (but not 11)
 *   few  → 2–4, 22–24 … (but not 12–14)
 *   many → 0, 5–20, 25–30 …
 * Messages with fewer forms fall back to vue-i18n's default indexing, so a locale
 * catalog that hasn't been expanded yet still renders (just less precisely).
 */
export function russianPluralRule(choice: number, choicesLength: number): number {
  if (choicesLength < 4) {
    // Mirror vue-i18n's default: zero|one|other for 3 forms, one|other for 2.
    if (choicesLength === 3) return choice === 0 ? 0 : choice === 1 ? 1 : 2;
    return choice === 1 ? 0 : 1;
  }
  const n = Math.abs(Math.trunc(choice));
  if (n === 0) return 0;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 1; // one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 2; // few
  return 3; // many
}

export const i18n = createI18n({
  legacy: false,
  locale: 'en', // real locale applied by bootstrapLocale() once its messages load
  fallbackLocale: 'en',
  messages: { en },
  missingWarn: false,
  fallbackWarn: false,
  // Only locales whose plural rule differs from the built-in one/other split need an
  // entry. Turkish/Japanese/Korean/Chinese have a single form (their catalogs repeat
  // it), and the Romance/Germanic locales match the default.
  pluralRules: { ru: russianPluralRule },
});

setDateLocale('en');

// vue-i18n infers the Locale type from the eager `messages` ({ en }), narrowing it
// to 'en'. We add locales at runtime, so access the dynamic bits through a
// permissive handle rather than fighting the inferred type at every call site.
const g = i18n.global as unknown as {
  availableLocales: readonly string[];
  locale: { value: string };
  setLocaleMessage: (locale: string, message: typeof en) => void;
};

/** Load a locale's messages on demand (no-op for en or an already-loaded locale). */
async function ensureMessages(code: LocaleCode): Promise<void> {
  if (code === 'en' || g.availableLocales.includes(code)) return;
  const loader = loaders[code];
  if (!loader) return;
  const mod = await loader();
  g.setLocaleMessage(code, mod.default);
}

/** Switch the active UI locale, loading its messages first; keeps the date locale
 * and the sync cache aligned. */
export async function setLocale(code: LocaleCode): Promise<void> {
  await ensureMessages(code);
  g.locale.value = code;
  setDateLocale(code);
  // Keep <html lang> in sync so assistive tech reads the UI in the right language
  // (the static index.html ships lang="en").
  if (typeof document !== 'undefined') document.documentElement.lang = code;
}

/** Resolve the cached preference and apply it. Await this before mounting so a
 * non-English user never sees a flash of English. A cached 'auto' resolves through
 * the CURRENT browser language, so following the browser keeps working. */
export async function bootstrapLocale(): Promise<void> {
  await setLocale(resolveLocale(cachedPref()));
}
