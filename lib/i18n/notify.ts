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

// Keep in sync with each locale's `notification.sessionAlert`. {domain} is the
// raw hostname (not localized — a hostname reads the same in every language).
const SESSION_ALERT: Record<string, string> = {
  en: "You've been on {domain} for {minutes}+ min",
  es: 'Llevas {minutes}+ min en {domain}',
  de: 'Du bist seit {minutes}+ Min. auf {domain}',
  fr: 'Vous êtes sur {domain} depuis {minutes}+ min',
  it: 'Sei su {domain} da {minutes}+ min',
  'pt-BR': 'Você está em {domain} há {minutes}+ min',
  ru: 'Вы на {domain} уже {minutes}+ мин',
  tr: '{domain} üzerinde {minutes}+ dk’dır bulunuyorsunuz',
  ja: '{domain} を {minutes} 分以上見ています',
  ko: '{domain}에서 {minutes}분 이상 머물렀습니다',
  'zh-CN': '你已在 {domain} 停留 {minutes}+ 分钟',
};

// Keep in sync with each locale's `notification.emailSummary`.
const EMAIL_SUMMARY: Record<string, string> = {
  en: 'Your {frequency} summary is ready — click to open a draft email',
  es: 'Tu resumen {frequency} está listo — haz clic para abrir un borrador de correo',
  de: 'Deine {frequency} Zusammenfassung ist fertig — klicken, um einen E-Mail-Entwurf zu öffnen',
  fr: 'Votre résumé {frequency} est prêt — cliquez pour ouvrir un brouillon d’e-mail',
  it: 'Il tuo riepilogo {frequency} è pronto — clicca per aprire una bozza email',
  'pt-BR': 'Seu resumo {frequency} está pronto — clique para abrir um rascunho de e-mail',
  ru: 'Ваша {frequency} сводка готова — нажмите, чтобы открыть черновик письма',
  tr: '{frequency} özetiniz hazır — bir e-posta taslağı açmak için tıklayın',
  ja: '{frequency}サマリーの準備ができました — クリックしてメールの下書きを開く',
  ko: '{frequency} 요약이 준비되었습니다 — 클릭하여 이메일 초안 열기',
  'zh-CN': '你的{frequency}摘要已就绪 — 点击打开邮件草稿',
};
// Keep in sync with each locale's `notification.emailSummaryDaily` / `emailSummaryWeekly`.
const FREQUENCY_LABELS: Record<string, { daily: string; weekly: string }> = {
  en: { daily: 'daily', weekly: 'weekly' },
  es: { daily: 'diario', weekly: 'semanal' },
  de: { daily: 'tägliche', weekly: 'wöchentliche' },
  fr: { daily: 'quotidien', weekly: 'hebdomadaire' },
  it: { daily: 'giornaliero', weekly: 'settimanale' },
  'pt-BR': { daily: 'diário', weekly: 'semanal' },
  ru: { daily: 'ежедневная', weekly: 'еженедельная' },
  tr: { daily: 'günlük', weekly: 'haftalık' },
  ja: { daily: '日次', weekly: '週次' },
  ko: { daily: '일간', weekly: '주간' },
  'zh-CN': { daily: '每日', weekly: '每周' },
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

// Context-menu item titles + their confirmation notifications (commands.mjs /
// background.ts context-menu wiring). Same rationale as above: inline only what
// the service worker needs rather than importing the full vue-i18n catalogs.
// Keep in sync with each locale's `settings.pauseTracking` / `popup.resumeTracking`
// / `settings.removeExcludedAria` (menu titles deliberately reuse that wording).
const MENU_EXCLUDE_ON: Record<string, string> = {
  en: 'Exclude {domain} from TabStyr',
  es: 'Excluir {domain} de TabStyr',
  de: '{domain} von TabStyr ausschließen',
  fr: 'Exclure {domain} de TabStyr',
  it: 'Escludi {domain} da TabStyr',
  'pt-BR': 'Excluir {domain} do TabStyr',
  ru: 'Исключить {domain} из TabStyr',
  tr: '{domain} alanını TabStyr’dan hariç tut',
  ja: '{domain} を TabStyr から除外',
  ko: '{domain}을(를) TabStyr에서 제외',
  'zh-CN': '从 TabStyr 中排除 {domain}',
};
const MENU_EXCLUDE_OFF: Record<string, string> = {
  en: 'Stop excluding {domain}',
  es: 'Dejar de excluir {domain}',
  de: 'Ausschluss von {domain} aufheben',
  fr: 'Ne plus exclure {domain}',
  it: "Rimuovi l'esclusione di {domain}",
  'pt-BR': 'Parar de excluir {domain}',
  ru: 'Прекратить исключать {domain}',
  tr: '{domain} hariç tutmayı durdur',
  ja: '{domain} の除外を解除',
  ko: '{domain} 제외 해제',
  'zh-CN': '取消排除 {domain}',
};
const MENU_PAUSE_ON: Record<string, string> = {
  en: 'Pause tracking',
  es: 'Pausar seguimiento',
  de: 'Tracking pausieren',
  fr: 'Mettre le suivi en pause',
  it: 'Metti in pausa il monitoraggio',
  'pt-BR': 'Pausar rastreamento',
  ru: 'Приостановить отслеживание',
  tr: 'İzlemeyi duraklat',
  ja: 'トラッキングを一時停止',
  ko: '추적 일시 중지',
  'zh-CN': '暂停跟踪',
};
const MENU_PAUSE_OFF: Record<string, string> = {
  en: 'Resume tracking',
  es: 'Reanudar seguimiento',
  de: 'Tracking fortsetzen',
  fr: 'Reprendre le suivi',
  it: 'Riprendi il monitoraggio',
  'pt-BR': 'Retomar rastreamento',
  ru: 'Возобновить отслеживание',
  tr: 'İzlemeyi sürdür',
  ja: 'トラッキングを再開',
  ko: '추적 재개',
  'zh-CN': '恢复跟踪',
};
const MENU_DASHBOARD: Record<string, string> = {
  en: 'Open TabStyr dashboard',
  es: 'Abrir panel de TabStyr',
  de: 'TabStyr-Dashboard öffnen',
  fr: 'Ouvrir le tableau de bord TabStyr',
  it: 'Apri la dashboard di TabStyr',
  'pt-BR': 'Abrir painel do TabStyr',
  ru: 'Открыть панель TabStyr',
  tr: 'TabStyr panosunu aç',
  ja: 'TabStyr ダッシュボードを開く',
  ko: 'TabStyr 대시보드 열기',
  'zh-CN': '打开 TabStyr 仪表盘',
};
const NOTIF_EXCLUDED: Record<string, string> = {
  en: '{domain} is now excluded from tracking',
  es: '{domain} ahora está excluido del seguimiento',
  de: '{domain} ist jetzt von der Erfassung ausgeschlossen',
  fr: '{domain} est désormais exclu du suivi',
  it: '{domain} ora è escluso dal monitoraggio',
  'pt-BR': '{domain} agora está excluído do rastreamento',
  ru: '{domain} теперь исключён из отслеживания',
  tr: '{domain} artık izlemeden hariç tutuluyor',
  ja: '{domain} は計測から除外されました',
  ko: '{domain}이(가) 추적에서 제외되었습니다',
  'zh-CN': '{domain} 现已从跟踪中排除',
};
const NOTIF_UNEXCLUDED: Record<string, string> = {
  en: '{domain} is being tracked again',
  es: '{domain} se está rastreando de nuevo',
  de: '{domain} wird wieder erfasst',
  fr: '{domain} est de nouveau suivi',
  it: '{domain} è di nuovo monitorato',
  'pt-BR': '{domain} está sendo rastreado novamente',
  ru: '{domain} снова отслеживается',
  tr: '{domain} yeniden izleniyor',
  ja: '{domain} の計測を再開しました',
  ko: '{domain} 추적을 다시 시작합니다',
  'zh-CN': '{domain} 已重新开始跟踪',
};
const NOTIF_PAUSED: Record<string, string> = {
  en: 'Tracking paused',
  es: 'Seguimiento en pausa',
  de: 'Tracking pausiert',
  fr: 'Suivi en pause',
  it: 'Monitoraggio in pausa',
  'pt-BR': 'Rastreamento pausado',
  ru: 'Отслеживание приостановлено',
  tr: 'İzleme duraklatıldı',
  ja: 'トラッキングを一時停止しました',
  ko: '추적이 일시 중지되었습니다',
  'zh-CN': '已暂停跟踪',
};
const NOTIF_RESUMED: Record<string, string> = {
  en: 'Tracking resumed',
  es: 'Seguimiento reanudado',
  de: 'Tracking fortgesetzt',
  fr: 'Suivi repris',
  it: 'Monitoraggio ripreso',
  'pt-BR': 'Rastreamento retomado',
  ru: 'Отслеживание возобновлено',
  tr: 'İzleme sürdürülüyor',
  ja: 'トラッキングを再開しました',
  ko: '추적이 재개되었습니다',
  'zh-CN': '已恢复跟踪',
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

/** Localized continuous-session nudge, e.g. "You've been on reddit.com for 30+ min". */
export function sessionAlertNotification(languagePref: string | undefined, domain: string, minutes: number): string {
  return interpolate(SESSION_ALERT[resolve(languagePref)] ?? SESSION_ALERT.en, { domain, minutes });
}

/** Localized "your summary is ready" nudge for the given frequency. */
export function emailSummaryNotification(languagePref: string | undefined, frequency: 'daily' | 'weekly'): string {
  const lang = resolve(languagePref);
  const label = FREQUENCY_LABELS[lang]?.[frequency] ?? FREQUENCY_LABELS.en[frequency];
  return interpolate(EMAIL_SUMMARY[lang] ?? EMAIL_SUMMARY.en, { frequency: label });
}

/** Context-menu title for the exclude/un-exclude toggle, reflecting current state. */
export function menuExcludeTitle(languagePref: string | undefined, domain: string, excluded: boolean): string {
  const lang = resolve(languagePref);
  const table = excluded ? MENU_EXCLUDE_OFF : MENU_EXCLUDE_ON;
  return interpolate(table[lang] ?? table.en, { domain });
}

/** Context-menu title for the pause/resume toggle, reflecting current state. */
export function menuPauseTitle(languagePref: string | undefined, paused: boolean): string {
  const lang = resolve(languagePref);
  const table = paused ? MENU_PAUSE_OFF : MENU_PAUSE_ON;
  return table[lang] ?? table.en;
}

/** Context-menu title for the "open dashboard" item. */
export function menuDashboardTitle(languagePref: string | undefined): string {
  return MENU_DASHBOARD[resolve(languagePref)] ?? MENU_DASHBOARD.en;
}

/** Confirmation notification after toggling a site's excluded state from the menu. */
export function excludeToggleNotification(languagePref: string | undefined, domain: string, nowExcluded: boolean): string {
  const lang = resolve(languagePref);
  const table = nowExcluded ? NOTIF_EXCLUDED : NOTIF_UNEXCLUDED;
  return interpolate(table[lang] ?? table.en, { domain });
}

/** Confirmation notification after toggling pause from the menu or a keyboard shortcut. */
export function pauseToggleNotification(languagePref: string | undefined, nowPaused: boolean): string {
  const lang = resolve(languagePref);
  const table = nowPaused ? NOTIF_PAUSED : NOTIF_RESUMED;
  return table[lang] ?? table.en;
}
