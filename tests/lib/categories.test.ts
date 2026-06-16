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

  test('covers non-US sites in the built-in rules', () => {
    expect(categorize('yandex.ru')).toBe('Other'); // portal — intentionally not categorized
    expect(categorize('mail.yandex.ru')).toBe('Work');
    expect(categorize('www.bilibili.com')).toBe('Media');
    expect(categorize('weibo.com')).toBe('Social');
    expect(categorize('cafe.naver.com')).toBe('Social');
    expect(categorize('nikkei.com')).toBe('News');
    expect(categorize('taobao.com')).toBe('Shopping');
    expect(categorize('gitee.com')).toBe('Dev');
  });

  test('recognizes banks, payments, and investing as Finance', () => {
    expect(categorize('www.paypal.com')).toBe('Finance');
    expect(categorize('hsbc.co.uk')).toBe('Finance');
    expect(categorize('icicibank.com')).toBe('Finance');
    expect(categorize('sparkasse.de')).toBe('Finance');
    expect(categorize('coinbase.com')).toBe('Finance');
    expect(categorize('robinhood.com')).toBe('Finance');
    expect(categorize('chase.com')).toBe('Finance');
  });

  test('does not misclassify lookalike domains', () => {
    // The Finance token is 'chase.com', not bare 'chase', so 'purchase'-style
    // hosts are not swallowed.
    expect(categorize('mypurchases.example')).toBe('Other');
  });

  test('user rules (substring) beat built-in rules but lose to exact overrides', () => {
    const rules = [{ pattern: 'mybank', category: 'Work' as const }];
    expect(categorize('mybank.example', {}, rules)).toBe('Work');
    // exact override still wins over a matching user rule
    expect(categorize('mybank.example', { 'mybank.example': 'Other' }, rules)).toBe('Other');
  });

  test('user rules are applied in order, first match wins', () => {
    const rules = [
      { pattern: 'shop', category: 'Shopping' as const },
      { pattern: 'shopx', category: 'Work' as const },
    ];
    expect(categorize('shopx.io', {}, rules)).toBe('Shopping');
  });

  test('groupByCategory honours user rules', () => {
    const out = groupByCategory(
      [{ domain: 'naver.com', seconds: 40, audioSeconds: 0 }],
      {},
      [{ pattern: 'naver', category: 'News' }],
    );
    expect(out).toEqual([{ category: 'News', seconds: 40, audioSeconds: 0 }]);
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
