import { describe, expect, test } from 'vitest';
import { CHRONOTYPE_EMOJI, PERSONA_META } from '@/lib/wrapped-persona';
import { CHRONOTYPE_ICON, ICONS, PERSONA_ICON } from '@/lib/wrapped-icons';
import { buildWrapped } from '@/lib/wrapped';
import type { Chronotype, PersonaId } from '@/lib/wrapped';
import type { DailyStat, Session } from '@/lib/types';

// The presentation registries for Wrapped: emoji + gradient per persona, and the
// icon paths shared by the DOM and the share-card canvas. A missing entry renders an
// invisible glyph or an undefined gradient, and nothing caught that until now.

const PERSONAS: PersonaId[] = [
  'builder', 'operator', 'socialite', 'binger', 'analyst', 'tycoon', 'collector', 'wanderer', 'explorer',
];
const CHRONOTYPES: Chronotype[] = ['earlyBird', 'daytimer', 'nightOwl', 'allHours'];
const HEX = /^#[0-9a-f]{6}$/i;

describe('persona presentation metadata', () => {
  test('every persona has an emoji and two valid gradient stops', () => {
    for (const id of PERSONAS) {
      const meta = PERSONA_META[id];
      expect(meta, id).toBeDefined();
      expect(meta.emoji, id).not.toBe('');
      expect(meta.accentA, id).toMatch(HEX);
      expect(meta.accentB, id).toMatch(HEX);
      expect(meta.accentA, id).not.toBe(meta.accentB); // a gradient, not a flat fill
    }
  });

  test('the registry has no entries beyond the PersonaId union', () => {
    expect(Object.keys(PERSONA_META).sort()).toEqual([...PERSONAS].sort());
  });

  test('every chronotype has an emoji', () => {
    for (const c of CHRONOTYPES) expect(CHRONOTYPE_EMOJI[c], c).not.toBe('');
    expect(Object.keys(CHRONOTYPE_EMOJI).sort()).toEqual([...CHRONOTYPES].sort());
  });
});

describe('icon registry', () => {
  test('every persona and chronotype maps to an icon that exists', () => {
    for (const id of PERSONAS) {
      const name = PERSONA_ICON[id];
      expect(name, id).toBeDefined();
      expect(ICONS[name], `${id} → ${name}`).toBeDefined();
    }
    for (const c of CHRONOTYPES) {
      const name = CHRONOTYPE_ICON[c];
      expect(ICONS[name], `${c} → ${name}`).toBeDefined();
    }
  });

  test('every icon has at least one non-empty path on the 24×24 grid', () => {
    for (const [name, def] of Object.entries(ICONS)) {
      expect(def.paths.length, name).toBeGreaterThan(0);
      for (const d of def.paths) {
        expect(d, name).not.toBe('');
        // An SVG path always starts with a move command.
        expect(d.trim()[0].toLowerCase(), `${name}: ${d}`).toBe('m');
      }
    }
  });
});

describe('personas cover every buildWrapped outcome', () => {
  const day = (domain: string, seconds: number): DailyStat => ({
    date: '2026-06-11', domain, seconds, audioSeconds: 0,
  });
  const session = (domain: string): Session => ({
    tabId: 1, tabKey: 'k', url: `https://${domain}/`, domain,
    start: Date.parse('2026-06-11T10:00:00'), end: Date.parse('2026-06-11T11:00:00'), audio: false,
  });

  // One dominant domain per built-in category → the persona that category maps to.
  test.each([
    ['github.com', 'builder'],
    ['notion.so', 'operator'],
    ['reddit.com', 'socialite'],
    ['youtube.com', 'binger'],
    ['cnn.com', 'analyst'],
    ['paypal.com', 'tycoon'],
    ['amazon.com', 'collector'],
    ['some-unknown-site.example', 'wanderer'],
  ])('%s yields the %s persona, and it has presentation metadata', (domain, expected) => {
    const w = buildWrapped({ dailyStats: [day(domain, 3600)], sessions: [session(domain)] });
    expect(w?.persona.id).toBe(expected);
    expect(PERSONA_META[w!.persona.id]).toBeDefined();
    expect(ICONS[PERSONA_ICON[w!.persona.id]]).toBeDefined();
  });

  test('diffuse browsing yields explorer, which also has metadata', () => {
    // Four categories at ~25% each: nothing clears the 35% dominance threshold.
    const w = buildWrapped({
      dailyStats: [day('github.com', 900), day('reddit.com', 900), day('youtube.com', 900), day('cnn.com', 900)],
      sessions: [session('github.com')],
    });
    expect(w?.persona).toEqual({ id: 'explorer', category: null });
    expect(PERSONA_META.explorer).toBeDefined();
  });
});
