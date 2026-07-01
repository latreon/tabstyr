import { describe, expect, test } from 'vitest';
import { sessionKey, mergeSessions, maxMonthly, mergeDaily, mergeBackup, mergeSettingsMaps } from '@/lib/merge';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import type { DailyStat, MonthlyStat, Session, Settings } from '@/lib/types';

const T0 = new Date(2026, 5, 11, 10, 0).getTime();
const session = (p: Partial<Session>): Session => ({
  tabId: 1,
  tabKey: 'k1',
  url: 'https://a.com/x',
  domain: 'a.com',
  start: T0,
  end: T0 + 60_000,
  audio: false,
  ...p,
});
const daily = (p: Partial<DailyStat>): DailyStat => ({ date: '2026-06-11', domain: 'a.com', seconds: 60, audioSeconds: 0, ...p });
const monthly = (p: Partial<MonthlyStat>): MonthlyStat => ({ month: '2026-01', domain: 'a.com', seconds: 100, audioSeconds: 0, ...p });

describe('mergeSessions', () => {
  test('dedupes identical events and keeps distinct ones', () => {
    const dup = session({});
    const other = session({ start: T0 + 120_000, end: T0 + 180_000 });
    const merged = mergeSessions([dup], [{ ...dup }, other]);
    expect(merged).toHaveLength(2); // dup collapses, `other` kept
  });

  test('is idempotent — re-merging the same set changes nothing', () => {
    const a = [session({}), session({ tabKey: 'k2', domain: 'b.com' })];
    const once = mergeSessions(a, a);
    const twice = mergeSessions(once, a);
    expect(twice).toHaveLength(2);
  });

  test('same timestamps but different tabKey/domain/audio are distinct', () => {
    expect(sessionKey(session({}))).not.toBe(sessionKey(session({ audio: true })));
    expect(mergeSessions([session({})], [session({ audio: true })])).toHaveLength(2);
  });
});

describe('maxMonthly', () => {
  test('takes the larger per (month, domain), unions distinct', () => {
    const out = maxMonthly(
      [monthly({ seconds: 100, audioSeconds: 10 })],
      [monthly({ seconds: 250, audioSeconds: 5 }), monthly({ month: '2026-02', seconds: 30 })],
    );
    expect(out).toContainEqual({ month: '2026-01', domain: 'a.com', seconds: 250, audioSeconds: 10 });
    expect(out).toContainEqual({ month: '2026-02', domain: 'a.com', seconds: 30, audioSeconds: 0 });
  });

  test('idempotent', () => {
    const a = [monthly({ seconds: 100 })];
    expect(maxMonthly(a, a)).toEqual([monthly({ seconds: 100 })]);
  });
});

describe('mergeDaily', () => {
  test('session-covered days are re-derived from the merged sessions (true combine)', () => {
    // Two distinct 60s sessions on a.com same day → rollup = 120s, beating either daily row.
    const s = mergeSessions([session({})], [session({ start: T0 + 120_000, end: T0 + 180_000 })]);
    const out = mergeDaily([daily({ seconds: 60 })], [daily({ seconds: 60 })], s);
    expect(out).toEqual([daily({ seconds: 120 })]);
  });

  test('session-less (date, domain) rows fall back to max of the two sources', () => {
    const out = mergeDaily([daily({ date: '2026-01-01', seconds: 100 })], [daily({ date: '2026-01-01', seconds: 250 })], []);
    expect(out).toEqual([daily({ date: '2026-01-01', seconds: 250 })]);
  });
});

describe('mergeBackup', () => {
  test('combines sessions, daily (from sessions), and monthly (max)', () => {
    const local = { sessions: [session({})], dailyStats: [daily({ seconds: 60 })], monthlyStats: [monthly({ seconds: 100 })] };
    const incoming = {
      sessions: [session({ start: T0 + 120_000, end: T0 + 180_000 })],
      dailyStats: [daily({ seconds: 60 })],
      monthlyStats: [monthly({ seconds: 300 })],
    };
    const r = mergeBackup(local, incoming);
    expect(r.sessions).toHaveLength(2);
    expect(r.dailyStats).toEqual([daily({ seconds: 120 })]);
    expect(r.monthlyStats).toEqual([monthly({ seconds: 300 })]);
  });

  test('idempotent — merging a backup into itself is a no-op on totals', () => {
    const data = { sessions: [session({})], dailyStats: [daily({ seconds: 60 })], monthlyStats: [monthly({ seconds: 100 })] };
    const r = mergeBackup(data, data);
    expect(r.sessions).toHaveLength(1);
    expect(r.dailyStats).toEqual([daily({ seconds: 60 })]);
    expect(r.monthlyStats).toEqual([monthly({ seconds: 100 })]);
  });
});

describe('mergeSettingsMaps', () => {
  const local: Settings = {
    ...DEFAULT_SETTINGS,
    categoryOverrides: { 'a.com': 'Work' },
    domainTags: { 'a.com': 'Acme' },
    categoryRules: [{ pattern: 'foo', category: 'Dev' }],
  };

  test('unions maps with local winning on conflicts, adopts incoming extras', () => {
    const merged = mergeSettingsMaps(local, {
      categoryOverrides: { 'a.com': 'Social', 'b.com': 'News' }, // a.com conflict → local wins
      domainTags: { 'c.com': 'Beta' },
      categoryRules: [{ pattern: 'foo', category: 'Media' }, { pattern: 'bar', category: 'Finance' }],
    });
    expect(merged.categoryOverrides).toEqual({ 'a.com': 'Work', 'b.com': 'News' });
    expect(merged.domainTags).toEqual({ 'a.com': 'Acme', 'c.com': 'Beta' });
    expect(merged.categoryRules).toEqual([
      { pattern: 'foo', category: 'Dev' }, // local kept, incoming dup ignored
      { pattern: 'bar', category: 'Finance' }, // incoming extra adopted
    ]);
  });

  test('missing/invalid incoming settings → local maps unchanged', () => {
    const merged = mergeSettingsMaps(local, undefined);
    expect(merged.categoryOverrides).toEqual({ 'a.com': 'Work' });
    expect(merged.domainTags).toEqual({ 'a.com': 'Acme' });
  });

  test('unions custom categories, local winning on a name clash', () => {
    const withCats: Settings = {
      ...local,
      customCategories: [{ name: 'Learning', color: '#111111', productivity: 'productive' }],
    };
    const merged = mergeSettingsMaps(withCats, {
      customCategories: [
        { name: 'learning', color: '#999999', productivity: 'neutral' }, // clash → local kept
        { name: 'Gaming', color: '#222222', productivity: 'distracting' }, // extra adopted
      ],
    });
    expect(merged.customCategories).toEqual([
      { name: 'Learning', color: '#111111', productivity: 'productive' },
      { name: 'Gaming', color: '#222222', productivity: 'distracting' },
    ]);
  });
});
