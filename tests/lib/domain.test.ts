import { describe, expect, test } from 'vitest';
import { domainOf, isWebDomain, isLocalDevHost, pageOf, pagePath } from '@/lib/domain';

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

  test('accepts localhost (dotless but a real dev host)', () => {
    expect(isWebDomain('localhost')).toBe(true);
  });

  test('local-dev policy: tracks bare IPv4 hosts, rejects IPv6 literals', () => {
    expect(isWebDomain('127.0.0.1')).toBe(true);
    expect(isWebDomain('192.168.1.10')).toBe(true);
    expect(isWebDomain('[::1]')).toBe(false); // IPv6 literal — accepted gap
  });
});

describe('isLocalDevHost', () => {
  test('matches localhost and IPv4 literals', () => {
    expect(isLocalDevHost('localhost')).toBe(true);
    expect(isLocalDevHost('127.0.0.1')).toBe(true);
    expect(isLocalDevHost('10.0.0.5')).toBe(true);
  });

  test('does not match real domains', () => {
    expect(isLocalDevHost('github.com')).toBe(false);
    expect(isLocalDevHost('1.2.3.4.example.com')).toBe(false);
  });
});

describe('pageOf', () => {
  test('keeps scheme + host + path, strips query and fragment', () => {
    expect(pageOf('https://youtube.com/watch?v=abc#t=10')).toBe('https://youtube.com/watch');
    expect(pageOf('https://a.com/x/y/')).toBe('https://a.com/x/y/');
  });

  test('collapses query-only variants of one page to the same key', () => {
    expect(pageOf('https://a.com/p?a=1')).toBe(pageOf('https://a.com/p?a=2'));
  });

  test('returns non-web / invalid urls unchanged', () => {
    expect(pageOf('chrome://settings')).toBe('chrome://settings');
    expect(pageOf('not a url')).toBe('not a url');
  });

  test('keeps a #/ hash route (hash-router SPA) but drops its query', () => {
    expect(pageOf('https://mail.app/#/inbox')).toBe('https://mail.app/#/inbox');
    expect(pageOf('https://mail.app/#/cb?token=secret')).toBe('https://mail.app/#/cb');
  });

  test('drops bare anchors and OAuth-token fragments (never a sub-page)', () => {
    expect(pageOf('https://a.com/p#section')).toBe('https://a.com/p');
    expect(pageOf('https://a.com/#access_token=xyz&id=1')).toBe('https://a.com/');
  });
});

describe('pagePath', () => {
  test('returns the pathname, trimming a trailing slash except root', () => {
    expect(pagePath('https://a.com/watch')).toBe('/watch');
    expect(pagePath('https://a.com/x/y/')).toBe('/x/y');
    expect(pagePath('https://a.com/')).toBe('/');
    expect(pagePath('https://a.com')).toBe('/');
  });

  test('surfaces a #/ hash route as the label', () => {
    expect(pagePath('https://mail.app/#/inbox')).toBe('#/inbox');
    expect(pagePath('https://app.com/admin#/users')).toBe('/admin#/users');
    expect(pagePath('https://a.com/p#section')).toBe('/p'); // non-route fragment ignored
  });
});
