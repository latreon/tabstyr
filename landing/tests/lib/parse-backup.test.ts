import { describe, expect, test } from 'vitest';
import { parseBackup, sanitizeCategoryConfig, MAX_BACKUP_BYTES } from '@/lib/parse-backup';

function validBackupJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    app: 'tabstyr',
    schemaVersion: 3,
    exportedAt: '2026-07-13T08:00:00.000Z',
    dailyStats: [{ date: '2026-07-13', domain: 'github.com', seconds: 120, audioSeconds: 0 }],
    sessions: [
      { domain: 'github.com', url: 'https://github.com/foo', start: 1000, end: 61000, audio: false, tabKey: 'k1' },
    ],
    settings: { staleDays: 3 },
    ...overrides,
  });
}

describe('parseBackup', () => {
  test('parses a well-formed backup', () => {
    const parsed = parseBackup(validBackupJson());
    expect(parsed.dailyStats).toHaveLength(1);
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.settings).toEqual({ staleDays: 3 });
    expect(parsed.exportedAt).toBe('2026-07-13T08:00:00.000Z');
  });

  test('rejects a file over MAX_BACKUP_BYTES', () => {
    const huge = 'x'.repeat(MAX_BACKUP_BYTES + 1);
    expect(() => parseBackup(huge)).toThrow('too large');
  });

  test('rejects invalid JSON', () => {
    expect(() => parseBackup('{not json')).toThrow('Not a valid JSON file');
  });

  test('rejects a file that is not a tabstyr backup', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'other' }))).toThrow('Not a TabStyr backup file');
  });

  test('rejects a backup from a newer schema version', () => {
    expect(() => parseBackup(validBackupJson({ schemaVersion: 999 }))).toThrow('newer version');
  });

  test('drops a malformed daily stat (bad date, negative seconds, audio > total)', () => {
    const parsed = parseBackup(
      validBackupJson({
        dailyStats: [
          { date: 'not-a-date', domain: 'a.com', seconds: 10, audioSeconds: 0 },
          { date: '2026-07-13', domain: 'a.com', seconds: -5, audioSeconds: 0 },
          { date: '2026-07-13', domain: 'a.com', seconds: 10, audioSeconds: 20 }, // audio > total
          { date: '2026-07-13', domain: 'good.com', seconds: 30, audioSeconds: 5 },
        ],
      }),
    );
    expect(parsed.dailyStats).toEqual([{ date: '2026-07-13', domain: 'good.com', seconds: 30, audioSeconds: 5 }]);
  });

  test('drops a session spanning longer than 24h or with end before start', () => {
    const parsed = parseBackup(
      validBackupJson({
        sessions: [
          { domain: 'a.com', url: 'https://a.com', start: 1000, end: 1000 + 25 * 60 * 60_000, audio: false },
          { domain: 'a.com', url: 'https://a.com', start: 5000, end: 1000, audio: false },
        ],
      }),
    );
    expect(parsed.sessions).toEqual([]);
  });

  test('re-derives domain from url, ignoring a spoofed domain field', () => {
    const parsed = parseBackup(
      validBackupJson({
        sessions: [
          { domain: 'trusted.com', url: 'https://evil.com/x', start: 1000, end: 61000, audio: false },
        ],
      }),
    );
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.sessions[0].domain).toBe('evil.com');
  });

  test('drops sessions/stats for internal (non-web) domains', () => {
    const parsed = parseBackup(
      validBackupJson({
        dailyStats: [{ date: '2026-07-13', domain: 'localhost', seconds: 10, audioSeconds: 0 }],
        sessions: [{ domain: 'x', url: 'chrome://settings', start: 1000, end: 61000, audio: false }],
      }),
    );
    // localhost IS a web domain (dev host) per isWebDomain, so it survives;
    // an internal chrome:// page never does.
    expect(parsed.dailyStats.map((s) => s.domain)).toEqual(['localhost']);
    expect(parsed.sessions).toEqual([]);
  });

  test('caps an oversized settings object rather than crashing', () => {
    const big: Record<string, number> = {};
    for (let i = 0; i < 1500; i++) big[`k${i}`] = i;
    const parsed = parseBackup(validBackupJson({ settings: big }));
    expect(parsed.settings).toBeUndefined();
  });

  test('missing optional fields default to empty arrays / undefined', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'tabstyr' }));
    expect(parsed.dailyStats).toEqual([]);
    expect(parsed.sessions).toEqual([]);
    expect(parsed.settings).toBeUndefined();
    expect(parsed.exportedAt).toBeUndefined();
  });
});

describe('sanitizeCategoryConfig', () => {
  test('returns empty config for non-object input', () => {
    expect(sanitizeCategoryConfig(null)).toEqual({ overrides: {}, rules: [], customCategories: [] });
    expect(sanitizeCategoryConfig('nope')).toEqual({ overrides: {}, rules: [], customCategories: [] });
  });

  test('keeps a valid custom category and drops a bad hex color', () => {
    const { customCategories } = sanitizeCategoryConfig({
      customCategories: [
        { name: 'Learning', color: '#123abc', productivity: 'productive' },
        { name: 'BadColor', color: 'red', productivity: 'neutral' },
      ],
    });
    expect(customCategories).toEqual([{ name: 'Learning', color: '#123abc', productivity: 'productive' }]);
  });

  test('rejects a custom category colliding with a built-in name', () => {
    const { customCategories } = sanitizeCategoryConfig({
      customCategories: [{ name: 'Work', color: '#123abc', productivity: 'neutral' }],
    });
    expect(customCategories).toEqual([]);
  });

  test('keeps an override pointing at a built-in category and drops one at an unknown category', () => {
    const { overrides } = sanitizeCategoryConfig({
      categoryOverrides: { 'a.com': 'Work', 'b.com': 'NotACategory' },
    });
    expect(overrides).toEqual({ 'a.com': 'Work' });
  });

  test('keeps a rule pointing at a valid custom category and normalizes its pattern', () => {
    const { rules } = sanitizeCategoryConfig({
      customCategories: [{ name: 'Learning', color: '#123abc', productivity: 'neutral' }],
      categoryRules: [{ pattern: '  Coursera ', category: 'Learning' }],
    });
    expect(rules).toEqual([{ pattern: 'coursera', category: 'Learning' }]);
  });

  test('drops a rule pointing at a category that is neither built-in nor a defined custom', () => {
    const { rules } = sanitizeCategoryConfig({
      categoryRules: [{ pattern: 'udemy', category: 'Learning' }], // Learning not defined here
    });
    expect(rules).toEqual([]);
  });
});
