import { describe, expect, test } from 'vitest';
import { resolveDomain, sanitizeDomainAliases, resolveDailyStats, resolveSessions } from '@/lib/domain-aliases';
import type { DailyStat, Session } from '@/lib/types';

function stat(partial: Partial<DailyStat>): DailyStat {
  return { date: '2026-07-13', domain: 'a.com', seconds: 60, audioSeconds: 0, ...partial };
}

function session(partial: Partial<Session>): Session {
  return { tabId: 1, tabKey: 'k1', url: 'https://a.com/x', domain: 'a.com', start: 0, end: 60_000, audio: false, ...partial };
}

describe('resolveDomain', () => {
  test('returns the alias target when one is set', () => {
    expect(resolveDomain('mail.google.com', { 'mail.google.com': 'google.com' })).toBe('google.com');
  });

  test('returns the domain itself when no alias is set', () => {
    expect(resolveDomain('github.com', { 'mail.google.com': 'google.com' })).toBe('github.com');
  });

  test('resolves only one hop (no transitive chain resolution)', () => {
    const aliases = { 'a.com': 'b.com', 'b.com': 'c.com' };
    expect(resolveDomain('a.com', aliases)).toBe('b.com'); // not 'c.com'
  });
});

describe('sanitizeDomainAliases', () => {
  test('drops non-object input', () => {
    expect(sanitizeDomainAliases(undefined)).toEqual({});
    expect(sanitizeDomainAliases('nope')).toEqual({});
    expect(sanitizeDomainAliases(null)).toEqual({});
  });

  test('trims and lowercases both source and target', () => {
    expect(sanitizeDomainAliases({ ' Mail.Google.com ': ' Google.COM ' })).toEqual({
      'mail.google.com': 'google.com',
    });
  });

  test('drops an entry whose target is not a string', () => {
    expect(sanitizeDomainAliases({ 'a.com': 123 })).toEqual({});
  });

  test('drops an entry aliasing a domain to itself', () => {
    expect(sanitizeDomainAliases({ 'a.com': 'a.com', 'b.com': 'c.com' })).toEqual({ 'b.com': 'c.com' });
  });

  test('drops an entry with a blank source or target after trimming', () => {
    expect(sanitizeDomainAliases({ '  ': 'a.com', 'b.com': '   ' })).toEqual({});
  });

  test('caps the number of stored aliases', () => {
    const raw: Record<string, string> = {};
    for (let i = 0; i < 250; i++) raw[`site${i}.com`] = 'canonical.com';
    expect(Object.keys(sanitizeDomainAliases(raw))).toHaveLength(200);
  });
});

describe('resolveDailyStats', () => {
  test('returns a plain copy when there are no aliases', () => {
    const stats = [stat({})];
    const out = resolveDailyStats(stats, {});
    expect(out).toEqual(stats);
    expect(out).not.toBe(stats); // a copy, not the same array reference
  });

  test('relabels a row to its canonical domain', () => {
    const out = resolveDailyStats([stat({ domain: 'mail.google.com' })], { 'mail.google.com': 'google.com' });
    expect(out).toEqual([stat({ domain: 'google.com' })]);
  });

  test('merges two rows on the same date that alias to the same domain', () => {
    const out = resolveDailyStats(
      [
        stat({ domain: 'mail.google.com', seconds: 60, audioSeconds: 5 }),
        stat({ domain: 'google.com', seconds: 30, audioSeconds: 2 }),
      ],
      { 'mail.google.com': 'google.com' },
    );
    expect(out).toEqual([stat({ domain: 'google.com', seconds: 90, audioSeconds: 7 })]);
  });

  test('keeps rows for the same domain on different dates separate', () => {
    const out = resolveDailyStats(
      [
        stat({ date: '2026-07-13', domain: 'mail.google.com', seconds: 60 }),
        stat({ date: '2026-07-14', domain: 'mail.google.com', seconds: 30 }),
      ],
      { 'mail.google.com': 'google.com' },
    );
    expect(out).toEqual([
      stat({ date: '2026-07-13', domain: 'google.com', seconds: 60 }),
      stat({ date: '2026-07-14', domain: 'google.com', seconds: 30 }),
    ]);
  });

  test('leaves an unaliased domain untouched alongside a merged one', () => {
    const out = resolveDailyStats(
      [stat({ domain: 'mail.google.com' }), stat({ domain: 'github.com' })],
      { 'mail.google.com': 'google.com' },
    );
    expect(out.map((s) => s.domain).sort()).toEqual(['github.com', 'google.com']);
  });
});

describe('resolveSessions', () => {
  test('returns a plain copy when there are no aliases', () => {
    const sessions = [session({})];
    const out = resolveSessions(sessions, {});
    expect(out).toEqual(sessions);
    expect(out).not.toBe(sessions);
  });

  test('relabels each session to its canonical domain without merging rows', () => {
    const out = resolveSessions(
      [
        session({ tabId: 1, domain: 'mail.google.com', start: 0, end: 60_000 }),
        session({ tabId: 2, domain: 'mail.google.com', start: 60_000, end: 120_000 }),
      ],
      { 'mail.google.com': 'google.com' },
    );
    expect(out).toHaveLength(2); // still two distinct sessions, not merged
    expect(out.every((s) => s.domain === 'google.com')).toBe(true);
  });

  test('does not mutate the original session objects', () => {
    const original = session({ domain: 'mail.google.com' });
    resolveSessions([original], { 'mail.google.com': 'google.com' });
    expect(original.domain).toBe('mail.google.com');
  });
});
