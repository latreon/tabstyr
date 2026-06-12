import { describe, expect, test } from 'vitest';
import { categorize, groupByCategory, isCategory, CATEGORIES } from '@/lib/categories';

describe('categorize', () => {
  test('maps known domains to their default category', () => {
    expect(categorize('github.com')).toBe('Dev');
    expect(categorize('gitlab.elnino.tech')).toBe('Dev');
    expect(categorize('www.youtube.com')).toBe('Media');
    expect(categorize('twitter.com')).toBe('Social');
    expect(categorize('mail.google.com')).toBe('Work');
    expect(categorize('cnn.com')).toBe('News');
    expect(categorize('amazon.de')).toBe('Shopping');
  });

  test('falls back to Other for unknown domains', () => {
    expect(categorize('some-random-site.example')).toBe('Other');
  });

  test('user override beats the default rules', () => {
    expect(categorize('youtube.com', { 'youtube.com': 'Work' })).toBe('Work');
  });

  test('is case-insensitive', () => {
    expect(categorize('GitHub.com')).toBe('Dev');
  });
});

describe('isCategory', () => {
  test('accepts valid categories and rejects others', () => {
    for (const c of CATEGORIES) expect(isCategory(c)).toBe(true);
    expect(isCategory('Nonsense')).toBe(false);
    expect(isCategory(42)).toBe(false);
    expect(isCategory(undefined)).toBe(false);
  });
});

describe('groupByCategory', () => {
  test('aggregates domains into categories, sorted by time', () => {
    const out = groupByCategory([
      { domain: 'github.com', seconds: 100, audioSeconds: 0 },
      { domain: 'gitlab.com', seconds: 50, audioSeconds: 0 },
      { domain: 'youtube.com', seconds: 200, audioSeconds: 30 },
    ]);
    expect(out[0]).toEqual({ category: 'Media', seconds: 200, audioSeconds: 30 });
    expect(out[1]).toEqual({ category: 'Dev', seconds: 150, audioSeconds: 0 });
  });

  test('respects overrides during grouping', () => {
    const out = groupByCategory([{ domain: 'youtube.com', seconds: 60, audioSeconds: 0 }], {
      'youtube.com': 'Work',
    });
    expect(out).toEqual([{ category: 'Work', seconds: 60, audioSeconds: 0 }]);
  });
});
