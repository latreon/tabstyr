import { describe, expect, test } from 'vitest';
import { russianPluralRule } from '@/lib/i18n';
import en from '@/lib/i18n/locales/en.json';
import es from '@/lib/i18n/locales/es.json';
import de from '@/lib/i18n/locales/de.json';
import fr from '@/lib/i18n/locales/fr.json';
import it from '@/lib/i18n/locales/it.json';
import ja from '@/lib/i18n/locales/ja.json';
import ko from '@/lib/i18n/locales/ko.json';
import ptBR from '@/lib/i18n/locales/pt-BR.json';
import ru from '@/lib/i18n/locales/ru.json';
import tr from '@/lib/i18n/locales/tr.json';
import zhCN from '@/lib/i18n/locales/zh-CN.json';

type Tree = { [k: string]: string | Tree };
// All 11 shipped locales — was previously only checking 5 of them (es/de/fr/ja/zh-CN),
// so a broken/missing key in it, ko, pt-BR, ru, or tr could ship undetected.
const LOCALES: Record<string, Tree> = { es, de, fr, it, ja, ko, 'pt-BR': ptBR, ru, tr, 'zh-CN': zhCN };

function flatten(obj: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[prefix + k] = v;
    else Object.assign(out, flatten(v, prefix + k + '.'));
  }
  return out;
}

const enFlat = flatten(en as Tree);
// The invariant is which interpolation VARIABLES a message uses, as a set — not how
// many times each appears. Comparing the raw list forced every locale to use exactly
// as many plural forms as English, which is wrong for languages with a different
// plural rule (Russian needs one/few/many where English needs one/other).
const placeholders = (s: string) => [...new Set(s.match(/\{[a-zA-Z]+\}/g) ?? [])].sort();

describe('i18n catalogs', () => {
  for (const [code, msgs] of Object.entries(LOCALES)) {
    const flat = flatten(msgs);

    test(`${code} has exactly the same keys as en`, () => {
      expect(Object.keys(flat).sort()).toEqual(Object.keys(enFlat).sort());
    });

    test(`${code} uses the same placeholder variables per key`, () => {
      for (const key of Object.keys(enFlat)) {
        expect({ key, tokens: placeholders(flat[key]) }).toEqual({ key, tokens: placeholders(enFlat[key]) });
      }
    });

    test(`${code} keeps at least the 3 plural forms en declares for worklog.summary`, () => {
      // A locale may add forms (Russian: zero|one|few|many) but never drop below the
      // zero/one/other split the English copy relies on.
      expect(flat['worklog.summary'].split('|').length).toBeGreaterThanOrEqual(3);
    });
  }

  // Russian is the one shipped locale whose plural rule needs more forms than the
  // built-in one/other split (see russianPluralRule).
  test('ru declares 4 plural forms for every pluralized key', () => {
    const flat = flatten(ru as Tree);
    expect(flat['worklog.summary'].split('|')).toHaveLength(4);
    expect(flat['tabs.closed'].split('|')).toHaveLength(4);
  });

  test('en itself is internally consistent (no empty values)', () => {
    for (const [k, v] of Object.entries(enFlat)) expect(v, k).not.toBe('');
  });
});

describe('russianPluralRule', () => {
  // 4-form catalog: zero | one | few | many
  const pick = (n: number) => russianPluralRule(n, 4);

  test('picks the "one" form for 1, 21, 101 but not the teens', () => {
    for (const n of [1, 21, 31, 101, 1001]) expect(pick(n), String(n)).toBe(1);
    expect(pick(11)).toBe(3); // одиннадцать → many
  });

  test('picks the "few" form for 2-4 and their higher analogues', () => {
    for (const n of [2, 3, 4, 22, 33, 104]) expect(pick(n), String(n)).toBe(2);
  });

  test('picks the "many" form for 5-20 and 11-14 style teens', () => {
    for (const n of [5, 9, 12, 13, 14, 19, 20, 25, 111]) expect(pick(n), String(n)).toBe(3);
  });

  test('picks the dedicated "zero" form for 0', () => {
    expect(pick(0)).toBe(0);
  });

  test('falls back to vue-i18n default indexing for shorter catalogs', () => {
    // 3 forms → zero | one | other
    expect(russianPluralRule(0, 3)).toBe(0);
    expect(russianPluralRule(1, 3)).toBe(1);
    expect(russianPluralRule(7, 3)).toBe(2);
    // 2 forms → one | other
    expect(russianPluralRule(1, 2)).toBe(0);
    expect(russianPluralRule(3, 2)).toBe(1);
  });

  test('resolves the real Russian catalog to grammatical strings', () => {
    const forms = flatten(ru as Tree)['tabs.closed'].split(' | ');
    expect(forms[pick(1)]).toContain('вкладка');
    expect(forms[pick(3)]).toContain('вкладки');
    expect(forms[pick(7)]).toContain('вкладок');
    expect(forms[pick(11)]).toContain('вкладок');
  });
});
