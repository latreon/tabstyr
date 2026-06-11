import { describe, expect, test } from 'vitest';
import { domainOf } from '@/lib/domain';

describe('domainOf', () => {
  test('extracts hostname from http(s) urls', () => {
    expect(domainOf('https://github.com/user/repo')).toBe('github.com');
    expect(domainOf('http://localhost:3000/x')).toBe('localhost');
  });

  test('returns protocol name for non-web urls', () => {
    expect(domainOf('chrome://settings')).toBe('chrome');
    expect(domainOf('about:blank')).toBe('about');
  });

  test('returns "other" for invalid urls', () => {
    expect(domainOf('')).toBe('other');
    expect(domainOf('not a url')).toBe('other');
  });
});
