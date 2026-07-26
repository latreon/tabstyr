import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { applyCachedTheme, cacheTheme } from '@/lib/theme-cache';

// The pre-paint theme mirror. It runs before Vue mounts, so a bug here is a visible
// dark↔light flash on every dashboard open — and it must never throw, because it
// executes in the document <head> ahead of any error handling.

function stubSystemDark(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  stubSystemDark(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('theme cache', () => {
  test('a cached explicit theme is applied verbatim', () => {
    cacheTheme('dark');
    applyCachedTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');

    cacheTheme('light');
    applyCachedTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  test('an explicit theme wins over the opposite system preference', () => {
    stubSystemDark(true);
    cacheTheme('light');
    applyCachedTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  test('"system" resolves through prefers-color-scheme', () => {
    cacheTheme('system');
    stubSystemDark(true);
    applyCachedTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');

    stubSystemDark(false);
    applyCachedTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  test('nothing cached, or a junk value, falls back to the system preference', () => {
    stubSystemDark(true);
    applyCachedTheme(); // empty storage
    expect(document.documentElement.dataset.theme).toBe('dark');

    localStorage.setItem('tabstyr:theme', 'neon');
    applyCachedTheme();
    expect(document.documentElement.dataset.theme).toBe('dark'); // treated as 'system'
  });

  test('never throws when storage is unavailable (private mode / disabled)', () => {
    const boom = () => {
      throw new Error('SecurityError');
    };
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
    expect(() => cacheTheme('dark')).not.toThrow();
    expect(() => applyCachedTheme()).not.toThrow();
  });
});
