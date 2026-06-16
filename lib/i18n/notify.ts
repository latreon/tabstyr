// Lightweight, vue-i18n-free message lookup for the background service worker
// (which has no Vue runtime). Bundles only the small JSON catalogs and does
// simple {token} interpolation — used for the stale-tab notification.
import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import zhCN from './locales/zh-CN.json';

const CATALOGS: Record<string, typeof en> = { en, es, de, fr, ja, 'zh-CN': zhCN };
const CODES = Object.keys(CATALOGS);

function resolve(pref: string | undefined): string {
  if (pref && pref !== 'auto' && CODES.includes(pref)) return pref;
  const ui = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  if (CODES.includes(ui)) return ui;
  const hit = CODES.find((c) => c.split('-')[0] === ui.split('-')[0]);
  return hit ?? 'en';
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

/** Localized stale-tab notification message for a stored language preference. */
export function staleNotification(languagePref: string | undefined, count: number, days: number): string {
  const cat = CATALOGS[resolve(languagePref)] ?? en;
  return interpolate(cat.notification.stale, { count, days });
}
