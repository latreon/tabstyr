import { describe, expect, test } from 'vitest';
import { domainOf, isWebDomain } from '@/lib/domain';

describe('domainOf', () => {
  test('extracts hostname from http(s) urls', () => {
    expect(domainOf('https://github.com/user/repo')).toBe('github.com');
    expect(domainOf('http://localhost:3000/x')).toBe('localhost');
  });

  test('returns protocol name for non-web urls', () => {
    expect(domainOf('chrome://settings')).toBe('chrome');
    expect(domainOf('about:blank')).toBe('about');
    expect(domainOf('chrome-extension://abc/popup.html')).toBe('chrome-extension');
  });

  test('returns "other" for invalid urls', () => {
    expect(domainOf('')).toBe('other');
    expect(domainOf('not a url')).toBe('other');
  });
});

describe('isWebDomain', () => {
  test('accepts real hostnames', () => {
    expect(isWebDomain('github.com')).toBe(true);
    expect(isWebDomain('sub.example.co.uk')).toBe(true);
  });

  test('rejects internal-scheme buckets from domainOf', () => {
    for (const d of ['chrome', 'about', 'chrome-extension', 'file', 'other', 'newtab']) {
      expect(isWebDomain(d)).toBe(false);
    }
  });

  test('rejects the empty string', () => {
    expect(isWebDomain('')).toBe(false);
  });
});
