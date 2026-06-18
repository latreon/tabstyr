// Lightweight, vue-i18n-free message lookup for the background service worker
// (which has no Vue runtime). Inlines ONLY the one string it needs per language —
// importing the full JSON catalogs here would bundle ~60 KB into background.js for
// a single key. Keep in sync with each locale's `notification.stale`.
const STALE: Record<string, string> = {
  en: '{count} tabs untouched for {days}+ days',
  es: '{count} pestañas sin tocar durante más de {days} días',
  de: '{count} Tabs seit über {days} Tagen unberührt',
  fr: '{count} onglets inactifs depuis plus de {days} jours',
  it: '{count} schede non toccate da {days}+ giorni',
  'pt-BR': '{count} abas sem uso por {days}+ dias',
  ru: '{count} вкладок не открывались {days}+ дней',
  tr: '{count} sekme {days}+ gündür kullanılmadı',
  ja: '{count} 個のタブが {days} 日以上未使用です',
  ko: '{count}개 탭이 {days}일 이상 사용되지 않음',
  'zh-CN': '{count} 个标签页已 {days} 天以上未使用',
};
const CODES = Object.keys(STALE);

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
  return interpolate(STALE[resolve(languagePref)] ?? STALE.en, { count, days });
}
