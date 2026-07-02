import { describe, expect, test } from 'vitest';
import {
  categorize,
  groupByCategory,
  isCategory,
  CATEGORIES,
  CATEGORY_PRODUCTIVITY,
  allCategoryIds,
  categoryColor,
  categoryLabel,
  categoryProductivityOf,
  type CustomCategory,
} from '@/lib/categories';

describe('categorize', () => {
  test('maps known domains to their default category', () => {
    expect(categorize('github.com')).toBe('Dev');
    expect(categorize('gitlab.example.com')).toBe('Dev');
    expect(categorize('www.youtube.com')).toBe('Media');
    expect(categorize('twitter.com')).toBe('Social');
    expect(categorize('mail.google.com')).toBe('Work');
    expect(categorize('cnn.com')).toBe('News');
    expect(categorize('amazon.de')).toBe('Shopping');
  });

  test('falls back to Other for unknown domains', () => {
    expect(categorize('some-random-site.example')).toBe('Other');
  });

  test('maps local-dev hosts (localhost / bare IPv4) to Dev', () => {
    expect(categorize('localhost')).toBe('Dev');
    expect(categorize('127.0.0.1')).toBe('Dev');
    expect(categorize('192.168.1.10')).toBe('Dev');
    // explicit override still wins over the local-dev default
    expect(categorize('127.0.0.1', { '127.0.0.1': 'Work' })).toBe('Work');
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

  test('matches built-in tokens on label boundaries, not raw substring', () => {
    // Real boundary matches still work…
    expect(categorize('mobile.x.com')).toBe('Social');
    expect(categorize('music.amazon.com')).toBe('Shopping');
    // …but lookalikes that merely contain a token are not swallowed.
    expect(categorize('notx.com')).toBe('Other'); // contains 'x.com'
    expect(categorize('myamazon-clone.com')).toBe('Other'); // contains 'amazon'
    expect(categorize('mygithub.io')).toBe('Other'); // contains 'github'
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

describe('custom category resolvers', () => {
  const CUSTOM: CustomCategory[] = [{ name: 'Learning', color: '#123abc', productivity: 'productive' }];

  test('an override can assign a domain to a custom category', () => {
    expect(categorize('coursera.org', { 'coursera.org': 'Learning' })).toBe('Learning');
  });

  test('a rule can route a domain to a custom category', () => {
    expect(categorize('go.udemy.com', {}, [{ pattern: 'udemy', category: 'Learning' }])).toBe('Learning');
  });

  test('categoryColor resolves built-ins from the map and customs from their def', () => {
    expect(categoryColor('Dev')).toBe('#10b981');
    expect(categoryColor('Learning', CUSTOM)).toBe('#123abc');
    expect(categoryColor('Unknown', CUSTOM)).toBe('#94a3b8'); // fallback
  });

  test('categoryLabel localizes built-ins but shows a custom name verbatim', () => {
    const t = (key: string) => `T:${key}`;
    expect(categoryLabel('Dev', t)).toBe('T:categories.Dev');
    expect(categoryLabel('Learning', t)).toBe('Learning');
  });

  test('categoryProductivityOf reads the mapping for built-ins and the def for customs', () => {
    expect(categoryProductivityOf('Social', CATEGORY_PRODUCTIVITY)).toBe('distracting');
    expect(categoryProductivityOf('Learning', CATEGORY_PRODUCTIVITY, CUSTOM)).toBe('productive');
    expect(categoryProductivityOf('Ghost', CATEGORY_PRODUCTIVITY, CUSTOM)).toBe('neutral'); // fallback
  });

  test('allCategoryIds appends custom names after the built-ins', () => {
    expect(allCategoryIds(CUSTOM)).toEqual([...CATEGORIES, 'Learning']);
  });
});
