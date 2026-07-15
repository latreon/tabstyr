import { describe, expect, test } from 'vitest';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import de from '@/i18n/locales/de.json';
import fr from '@/i18n/locales/fr.json';
import it from '@/i18n/locales/it.json';
import ja from '@/i18n/locales/ja.json';
import ko from '@/i18n/locales/ko.json';
import ptBR from '@/i18n/locales/pt-BR.json';
import ru from '@/i18n/locales/ru.json';
import tr from '@/i18n/locales/tr.json';
import zhCN from '@/i18n/locales/zh-CN.json';
import { LOCALES } from '@/i18n';

type Tree = { [k: string]: string | Tree };
// Unlike the extension, landing locales are deliberately PARTIAL overlays on
// English (t() falls back to English per-key for anything not yet
// translated) — so this does NOT assert every locale has every en key.
const LOCALES_JSON: Record<string, Tree> = { es, de, fr, it, ja, ko, 'pt-BR': ptBR, ru, tr, 'zh-CN': zhCN };

function flatten(obj: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[prefix + k] = v;
    else if (v && typeof v === 'object') Object.assign(out, flatten(v, prefix + k + '.'));
  }
  return out;
}

const enFlat = flatten(en as Tree);
const placeholders = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort();

describe('i18n catalogs', () => {
  for (const [code, msgs] of Object.entries(LOCALES_JSON)) {
    const flat = flatten(msgs);

    test(`${code} has no keys absent from en (no orphan/typo keys)`, () => {
      const orphans = Object.keys(flat).filter((k) => !(k in enFlat));
      expect(orphans).toEqual([]);
    });

    test(`${code} preserves every placeholder token on keys it does translate`, () => {
      for (const key of Object.keys(flat)) {
        expect({ key, tokens: placeholders(flat[key]) }).toEqual({ key, tokens: placeholders(enFlat[key]) });
      }
    });

    // Not checking "no empty values" here: unlike the extension's i18n, a
    // template-slot key can legitimately be '' in a given language — e.g.
    // ideaPage.titleLead is '' in ko/zh-CN because "{lead} {accent}{tail}"
    // reads naturally there with the subject folded into titleAccent/Tail.
  }

  test('en itself is internally consistent (no empty values)', () => {
    for (const [k, v] of Object.entries(enFlat)) expect(v, k).not.toBe('');
  });

  test('every non-English LOCALES entry has a matching locale file', () => {
    // Guards against adding a language to the picker (LOCALES) without adding
    // its ./locales/<code>.json + loaders entry — this test's static imports
    // above would fail to resolve first, but this makes the actual contract
    // (LOCALES ⇄ shipped locale files) explicit rather than an incidental
    // build failure.
    const nonEnglish = LOCALES.filter((l) => l.code !== 'en').map((l) => l.code);
    expect(nonEnglish.sort()).toEqual(Object.keys(LOCALES_JSON).sort());
  });
});
