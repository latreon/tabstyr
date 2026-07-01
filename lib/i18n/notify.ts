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
// Keep in sync with each locale's `notification.budget`. {category} is the
// localized category name (from CATEGORY_LABELS below).
const BUDGET: Record<string, string> = {
  en: 'Daily budget reached: {category}',
  es: 'Presupuesto diario alcanzado: {category}',
  de: 'Tagesbudget erreicht: {category}',
  fr: 'Budget quotidien atteint : {category}',
  it: 'Budget giornaliero raggiunto: {category}',
  'pt-BR': 'Limite diário atingido: {category}',
  ru: 'Дневной лимит достигнут: {category}',
  tr: 'Günlük bütçe doldu: {category}',
  ja: '本日の上限に到達: {category}',
  ko: '오늘 예산 도달: {category}',
  'zh-CN': '已达每日预算：{category}',
};

// Localized category names for the SW (which has no vue-i18n). Small, single-word
// strings — same rationale as STALE/STORAGE_FULL: inline rather than bundle the
// full catalogs. Keep in sync with each locale's `categories.*`.
const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  en: { Work: 'Work', Dev: 'Dev', Finance: 'Finance', Social: 'Social', Media: 'Media', News: 'News', Shopping: 'Shopping', Other: 'Other' },
  es: { Work: 'Trabajo', Dev: 'Desarrollo', Finance: 'Finanzas', Social: 'Social', Media: 'Multimedia', News: 'Noticias', Shopping: 'Compras', Other: 'Otro' },
  de: { Work: 'Arbeit', Dev: 'Dev', Finance: 'Finanzen', Social: 'Sozial', Media: 'Medien', News: 'Nachrichten', Shopping: 'Shopping', Other: 'Sonstiges' },
  fr: { Work: 'Travail', Dev: 'Dev', Finance: 'Finance', Social: 'Social', Media: 'Médias', News: 'Actus', Shopping: 'Achats', Other: 'Autre' },
  it: { Work: 'Lavoro', Dev: 'Dev', Finance: 'Finanza', Social: 'Social', Media: 'Media', News: 'Notizie', Shopping: 'Acquisti', Other: 'Altro' },
  'pt-BR': { Work: 'Trabalho', Dev: 'Dev', Finance: 'Finanças', Social: 'Social', Media: 'Mídia', News: 'Notícias', Shopping: 'Compras', Other: 'Outro' },
  ru: { Work: 'Работа', Dev: 'Разработка', Finance: 'Финансы', Social: 'Соцсети', Media: 'Медиа', News: 'Новости', Shopping: 'Покупки', Other: 'Другое' },
  tr: { Work: 'İş', Dev: 'Geliştirme', Finance: 'Finans', Social: 'Sosyal', Media: 'Medya', News: 'Haberler', Shopping: 'Alışveriş', Other: 'Diğer' },
  ja: { Work: '仕事', Dev: '開発', Finance: '金融', Social: 'ソーシャル', Media: 'メディア', News: 'ニュース', Shopping: '買い物', Other: 'その他' },
  ko: { Work: '업무', Dev: '개발', Finance: '금융', Social: '소셜', Media: '미디어', News: '뉴스', Shopping: '쇼핑', Other: '기타' },
  'zh-CN': { Work: '工作', Dev: '开发', Finance: '财务', Social: '社交', Media: '媒体', News: '新闻', Shopping: '购物', Other: '其他' },
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

/**
 * Localized budget-reached notification. `category` is the canonical English
 * category key; it's localized via CATEGORY_LABELS before interpolation.
 */
export function budgetNotification(languagePref: string | undefined, category: string): string {
  const lang = resolve(languagePref);
  const label = CATEGORY_LABELS[lang]?.[category] ?? CATEGORY_LABELS.en[category] ?? category;
  return interpolate(BUDGET[lang] ?? BUDGET.en, { category: label });
}
