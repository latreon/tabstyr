import { describe, expect, test } from 'vitest';
import { hexToHsv, hsvToHex, isValidHex, normalizeHex } from '@/lib/color';

describe('isValidHex', () => {
  test('accepts 3- and 6-digit hex', () => {
    expect(isValidHex('#abc')).toBe(true);
    expect(isValidHex('#aabbcc')).toBe(true);
    expect(isValidHex('#ABCDEF')).toBe(true);
  });

  test('rejects malformed input', () => {
    expect(isValidHex('abc')).toBe(false);
    expect(isValidHex('#gggggg')).toBe(false);
    expect(isValidHex('#ab')).toBe(false);
    expect(isValidHex('')).toBe(false);
  });
});

describe('normalizeHex', () => {
  test('expands 3-digit shorthand to 6 digits, lowercased', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
  });

  test('lowercases an already-6-digit hex', () => {
    expect(normalizeHex('#FF00AA')).toBe('#ff00aa');
  });
});

describe('hexToHsv / hsvToHex', () => {
  test('primary colors round-trip', () => {
    expect(hsvToHex(0, 1, 1)).toBe('#ff0000');
    expect(hsvToHex(120, 1, 1)).toBe('#00ff00');
    expect(hsvToHex(240, 1, 1)).toBe('#0000ff');
  });

  test('white, black and gray have no hue/saturation signal', () => {
    expect(hexToHsv('#ffffff')).toEqual({ h: 0, s: 0, v: 1 });
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
    const gray = hexToHsv('#808080');
    expect(gray.s).toBe(0);
    expect(gray.v).toBeCloseTo(0.5, 1);
  });

  test('hex -> hsv -> hex round-trips for an arbitrary color', () => {
    const start = normalizeHex('#6366f1'); // indigo, one of the category preset colors
    const { h, s, v } = hexToHsv(start);
    expect(hsvToHex(h, s, v)).toBe(start);
  });
});
