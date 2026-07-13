import { describe, expect, test } from 'vitest';
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
const placeholders = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort();

describe('i18n catalogs', () => {
  for (const [code, msgs] of Object.entries(LOCALES)) {
    const flat = flatten(msgs);

    test(`${code} has exactly the same keys as en`, () => {
      expect(Object.keys(flat).sort()).toEqual(Object.keys(enFlat).sort());
    });

    test(`${code} preserves every placeholder token per key`, () => {
      for (const key of Object.keys(enFlat)) {
        expect({ key, tokens: placeholders(flat[key]) }).toEqual({ key, tokens: placeholders(enFlat[key]) });
      }
    });

    test(`${code} keeps the 3-form plural for worklog.summary`, () => {
      expect(flat['worklog.summary'].split('|')).toHaveLength(3);
    });
  }

  test('en itself is internally consistent (no empty values)', () => {
    for (const [k, v] of Object.entries(enFlat)) expect(v, k).not.toBe('');
  });
});
