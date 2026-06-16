// A tiny module-level holder for the active BCP-47 locale, so pure date/number
// helpers in lib/ (which must not depend on Vue or vue-i18n) can format using
// the language the user picked. The i18n layer keeps this in sync.
let dateLocale = 'en';

export function setDateLocale(locale: string): void {
  dateLocale = locale;
}

export function getDateLocale(): string {
  return dateLocale;
}
