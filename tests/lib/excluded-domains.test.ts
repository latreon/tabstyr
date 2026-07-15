import { describe, expect, test } from 'vitest';
import { isExcludedDomain, sanitizeExcludedDomains } from '@/lib/excluded-domains';

describe('isExcludedDomain', () => {
  test('matches the exact domain', () => {
    expect(isExcludedDomain('reddit.com', ['reddit.com'])).toBe(true);
  });

  test('matches a subdomain of an excluded domain', () => {
    expect(isExcludedDomain('old.reddit.com', ['reddit.com'])).toBe(true);
  });

  test('does not match a domain that merely contains the pattern as a substring', () => {
    expect(isExcludedDomain('notreddit.com', ['reddit.com'])).toBe(false);
    expect(isExcludedDomain('reddit.com.evil.com', ['reddit.com'])).toBe(false);
  });

  test('is case-insensitive', () => {
    expect(isExcludedDomain('Reddit.COM', ['reddit.com'])).toBe(true);
  });

  test('returns false for an empty list without scanning', () => {
    expect(isExcludedDomain('anything.com', [])).toBe(false);
  });
});

describe('sanitizeExcludedDomains', () => {
  test('drops non-array input', () => {
    expect(sanitizeExcludedDomains(undefined)).toEqual([]);
    expect(sanitizeExcludedDomains('reddit.com')).toEqual([]);
    expect(sanitizeExcludedDomains({ a: 1 })).toEqual([]);
  });

  test('trims, lowercases, and drops empty/duplicate entries', () => {
    expect(sanitizeExcludedDomains([' Reddit.com ', 'reddit.com', '', '   ', 42])).toEqual(['reddit.com']);
  });

  test('caps the list at 200 entries', () => {
    const raw = Array.from({ length: 250 }, (_, i) => `site${i}.com`);
    expect(sanitizeExcludedDomains(raw)).toHaveLength(200);
  });

  test('caps an absurdly long single entry at 253 characters', () => {
    const long = `${'a'.repeat(300)}.com`;
    expect(sanitizeExcludedDomains([long])[0]).toHaveLength(253);
  });
});
