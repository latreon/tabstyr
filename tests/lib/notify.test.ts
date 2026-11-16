import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  budgetNotification,
  sessionAlertNotification,
  staleNotification,
  storageFullNotification,
} from '@/lib/i18n/notify';
import { SUPPORTED_LOCALES } from '@/lib/i18n';
import { CATEGORIES } from '@/lib/categories';

// The background worker has no vue-i18n, so these inline tables are a SECOND copy of
// a handful of catalog strings. Untested until now, which is exactly how a locale
// gains a key here and loses it there.

const CODES = SUPPORTED_LOCALES.map((l) => l.code);

function stubUiLanguage(language: string) {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(language);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('notification catalogs', () => {
  test('every shipped locale has every message', () => {
    for (const code of CODES) {
      expect(staleNotification(code, 3, 5), code).not.toBe('');
      expect(storageFullNotification(code), code).not.toBe('');
      expect(budgetNotification(code, 'Social'), code).not.toBe('');
      expect(sessionAlertNotification(code, 'reddit.com', 30), code).not.toBe('');
    }
  });

  test('no message leaves an uninterpolated placeholder', () => {
    for (const code of CODES) {
      const messages = [
        staleNotification(code, 3, 5),
        storageFullNotification(code),
        budgetNotification(code, 'Social'),
        sessionAlertNotification(code, 'reddit.com', 30),
      ];
      for (const m of messages) expect(m, `${code}: ${m}`).not.toMatch(/\{\w+\}/);
    }
  });

  test('every built-in category has a localized label in every locale', () => {
    for (const code of CODES) {
      for (const category of CATEGORIES) {
        const msg = budgetNotification(code, category);
        // The English key must not leak through for a non-English locale unless that
        // locale genuinely reuses the English word (e.g. "Dev", "Social").
        expect(msg, `${code}/${category}`).not.toBe('');
        expect(msg, `${code}/${category}`).not.toMatch(/\{category\}/);
      }
    }
  });
});

describe('notification interpolation', () => {
  test('fills count/days, domain/minutes and the category label', () => {
    expect(staleNotification('en', 4, 3)).toBe('4 tabs untouched for 3+ days');
    expect(sessionAlertNotification('en', 'reddit.com', 30)).toBe("You've been on reddit.com for 30+ min");
    expect(budgetNotification('en', 'Social')).toBe('Daily budget reached: Social');
    expect(budgetNotification('es', 'Work')).toBe('Presupuesto diario alcanzado: Trabajo');
  });

  test('an unknown category falls back to the raw key rather than blanking out', () => {
    // Custom categories are user-authored names with no translation.
    expect(budgetNotification('en', 'Reading')).toBe('Daily budget reached: Reading');
  });
});

describe('notification text matches the app catalogs', () => {
  const catalogs = import.meta.glob<{ notification: Record<string, string>; categories: Record<string, string> }>('@/lib/i18n/locales/*.json', { eager: true, import: 'default' });
  const catalogOf = (code: string) => Object.entries(catalogs).find(([path]) => path.endsWith(`/${code}.json`))![1];
  const fill = (template: string, params: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name]));

  function expectSameText(code: string) {
    const { notification, categories } = catalogOf(code);
    expect(staleNotification(code, 4, 3)).toBe(fill(notification.stale!, { count: 4, days: 3 }));
    expect(sessionAlertNotification(code, 'reddit.com', 30)).toBe(fill(notification.sessionAlert!, { domain: 'reddit.com', minutes: 30 }));
    for (const category of CATEGORIES) {
      expect(budgetNotification(code, category)).toBe(fill(notification.budget!, { category: categories[category]! }));
    }
  }

  test.each(CODES)('%s', expectSameText);
});

describe('notification language resolution', () => {
  test('an explicit preference wins over the browser UI language', () => {
    stubUiLanguage('de');
    expect(staleNotification('ru', 2, 3)).toContain('вкладок');
  });

  test("'auto' follows the browser UI language", () => {
    stubUiLanguage('de');
    expect(staleNotification('auto', 2, 3)).toContain('Tabs');
  });

  test("'auto' matches on the base language of a regional UI locale", () => {
    stubUiLanguage('pt-PT'); // we ship pt-BR
    expect(staleNotification('auto', 2, 3)).toContain('abas');
  });

  test('an unsupported language falls back to English', () => {
    stubUiLanguage('is-IS');
    expect(staleNotification('auto', 2, 3)).toBe('2 tabs untouched for 3+ days');
    expect(staleNotification('kl', 2, 3)).toBe('2 tabs untouched for 3+ days');
  });

  test('undefined (never-set) preference resolves like auto', () => {
    stubUiLanguage('fr');
    expect(staleNotification(undefined, 2, 3)).toContain('onglets');
  });
});
