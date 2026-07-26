import { afterEach, describe, expect, test } from 'vitest';
import { getDateLocale, setDateLocale } from '@/lib/locale';
import { SUPPORTED_LOCALES } from '@/lib/i18n';
import { dayLabel, longDateLabel, monthLabel } from '@/lib/time';
import { COFFEE_URL } from '@/lib/support';

// The module-level date-locale holder: the bridge that lets the Vue-free helpers in
// lib/ format dates in the language the user picked. If it drifts out of step with
// vue-i18n, every date label silently reverts to English.

afterEach(() => {
  setDateLocale('en'); // the value i18n/index sets on import
});

describe('date locale holder', () => {
  test('defaults to en', () => {
    expect(getDateLocale()).toBe('en');
  });

  test('round-trips the active locale', () => {
    setDateLocale('de');
    expect(getDateLocale()).toBe('de');
  });

  test('the pure time helpers format through it', () => {
    setDateLocale('en');
    const en = { day: dayLabel('2026-06-11'), month: monthLabel('2026-06'), long: longDateLabel('2026-06-11') };
    setDateLocale('de');
    const de = { day: dayLabel('2026-06-11'), month: monthLabel('2026-06'), long: longDateLabel('2026-06-11') };
    // June abbreviates differently in the two languages ("Jun" vs "Juni"), and the
    // weekday name always does, so at least one label must change.
    expect([de.day !== en.day, de.month !== en.month, de.long !== en.long]).toContain(true);
  });

  test('every shipped locale is accepted by Intl (no crash on a real pick)', () => {
    for (const { code } of SUPPORTED_LOCALES) {
      setDateLocale(code);
      expect(() => dayLabel('2026-06-11'), code).not.toThrow();
      expect(dayLabel('2026-06-11'), code).not.toBe('');
    }
  });
});

describe('support link', () => {
  test('is either unconfigured (button hidden) or a prefilled https checkout URL', () => {
    if (!COFFEE_URL) {
      expect(COFFEE_URL).toBe(''); // the popup + dashboard hide the button in this case
      return;
    }
    const u = new URL(COFFEE_URL);
    expect(u.protocol).toBe('https:');
    expect(u.searchParams.get('amount')).toBe('500');
  });
});
