import { describe, expect, test } from 'vitest';
import { resolveTheme } from '@/composables/useTheme';

describe('resolveTheme', () => {
  test('system follows OS preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  test('explicit setting wins over OS', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });
});
