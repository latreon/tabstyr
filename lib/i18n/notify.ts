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
// Keep in sync with each locale's `notification.storageFull`.
const STORAGE_FULL: Record<string, string> = {
  en: 'Storage is full — tracking paused. Open TabStyr to export a backup, then clear old data.',
  es: 'Almacenamiento lleno — seguimiento en pausa. Abre TabStyr para exportar una copia y borrar datos antiguos.',
  de: 'Speicher voll — Erfassung pausiert. Öffne TabStyr, um ein Backup zu exportieren und alte Daten zu löschen.',
  fr: 'Stockage plein — suivi en pause. Ouvre TabStyr pour exporter une sauvegarde, puis effacer les anciennes données.',
  it: 'Spazio pieno — tracciamento in pausa. Apri TabStyr per esportare un backup ed eliminare i vecchi dati.',
  'pt-BR': 'Armazenamento cheio — rastreamento pausado. Abra o TabStyr para exportar um backup e apagar dados antigos.',
  ru: 'Хранилище заполнено — отслеживание приостановлено. Откройте TabStyr, чтобы экспортировать копию и удалить старые данные.',
  tr: 'Depolama dolu — izleme duraklatıldı. Yedek dışa aktarmak ve eski verileri silmek için TabStyr’ı açın.',
  ja: 'ストレージが満杯です — 計測を一時停止しました。TabStyr を開いてバックアップを書き出し、古いデータを削除してください。',
  ko: '저장 공간이 가득 찼습니다 — 추적이 일시 중지되었습니다. TabStyr를 열어 백업을 내보내고 오래된 데이터를 삭제하세요.',
  'zh-CN': '存储已满 — 已暂停统计。打开 TabStyr 导出备份并清除旧数据。',
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

/** Localized "storage full" notification message for a stored language preference. */
export function storageFullNotification(languagePref: string | undefined): string {
  return STORAGE_FULL[resolve(languagePref)] ?? STORAGE_FULL.en;
}
