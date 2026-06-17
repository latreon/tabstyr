import { createI18n } from 'vue-i18n';
import { setDateLocale } from '@/lib/locale';
import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import zhCN from './locales/zh-CN.json';
import ptBR from './locales/pt-BR.json';
import it from './locales/it.json';
import ru from './locales/ru.json';
import ko from './locales/ko.json';
import tr from './locales/tr.json';

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

function cachedPref(): string | undefined {
  try {
    return localStorage.getItem(CACHE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: resolveLocale(cachedPref()),
  fallbackLocale: 'en',
  messages: { en, es, de, fr, it, 'pt-BR': ptBR, ru, tr, ja, ko, 'zh-CN': zhCN },
  missingWarn: false,
  fallbackWarn: false,
});

setDateLocale(i18n.global.locale.value);

/** Switch the active UI locale, keep the date locale and the sync cache aligned. */
export function setLocale(code: LocaleCode): void {
  i18n.global.locale.value = code;
  setDateLocale(code);
  try {
    localStorage.setItem(CACHE_KEY, code);
  } catch {
    /* storage unavailable — locale still applies for this session */
  }
}
