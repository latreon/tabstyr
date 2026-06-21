import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';
import { resetDBConnection } from '@/lib/db/db';
import * as repo from '@/lib/db/repo';
import { parseBackup, restoreBackup, MAX_BACKUP_BYTES } from '@/lib/restore';
import { toJsonBackup } from '@/lib/export';
import { DEFAULT_SETTINGS } from '@/lib/settings';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDBConnection();
});

const backupText = () =>
  toJsonBackup(
    {
      dailyStats: [{ date: '2026-06-16', domain: 'github.com', seconds: 120, audioSeconds: 0 }],
      sessions: [
        { tabId: 1, tabKey: 'k1', url: 'https://github.com', domain: 'github.com', start: 1000, end: 61000, audio: false },
      ],
      tabMeta: [{ tabId: 1, key: 'k1', url: 'https://github.com', title: 'GH', lastActiveAt: 1000, createdAt: 1000 }],
      settings: { ...DEFAULT_SETTINGS, staleDays: 7 },
    },
    Date.now(),
  );

describe('parseBackup', () => {
  test('rejects non-TabStyr / invalid JSON', () => {
    expect(() => parseBackup('nope')).toThrow(/valid JSON/i);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/TabStyr backup/i);
  });

  test('parses valid backup and drops malformed records', () => {
    const text = JSON.stringify({
      app: 'tabstyr',
      dailyStats: [
        { date: '2026-06-16', domain: 'a.com', seconds: 10, audioSeconds: 0 },
        { date: 5, domain: 'bad' }, // malformed → dropped
      ],
      sessions: [],
      tabMeta: [],
    });
    const parsed = parseBackup(text);
    expect(parsed.dailyStats).toHaveLength(1);
    expect(parsed.sessions).toEqual([]);
  });

  test('drops sessions with a non-string tabKey, normalizes a missing one', () => {
    const text = JSON.stringify({
      app: 'tabstyr',
      sessions: [
        { tabKey: 'ok', domain: 'a.com', url: 'https://a.com', start: 1, end: 2, audio: false }, // valid
        { tabKey: null, domain: 'b.com', url: 'https://b.com', start: 1, end: 2, audio: false }, // hostile → dropped
        { tabKey: 123, domain: 'c.com', url: 'https://c.com', start: 1, end: 2, audio: false }, // hostile → dropped
        { domain: 'd.com', url: 'https://d.com', start: 1, end: 2, audio: false }, // legacy (no key) → kept as ''
      ],
    });
    const parsed = parseBackup(text);
    expect(parsed.sessions).toHaveLength(2);
    expect(parsed.sessions[0].tabKey).toBe('ok');
    expect(parsed.sessions[1].tabKey).toBe('');
  });

  test('drops tabMeta missing required fields (title/lastActiveAt/createdAt)', () => {
    const text = JSON.stringify({
      app: 'tabstyr',
      tabMeta: [
        { tabId: 1, key: 'k1', url: 'https://a.com', title: 'A', lastActiveAt: 1, createdAt: 1 }, // valid
        { tabId: 2, key: 'k2', url: 'https://b.com' }, // missing fields → dropped
      ],
    });
    expect(parseBackup(text).tabMeta).toHaveLength(1);
  });

  test('validates exportedAt — bogus date strings are dropped', () => {
    expect(parseBackup(JSON.stringify({ app: 'tabstyr', exportedAt: 'not-a-date' })).exportedAt).toBeUndefined();
    const iso = '2026-06-16T00:00:00.000Z';
    expect(parseBackup(JSON.stringify({ app: 'tabstyr', exportedAt: iso })).exportedAt).toBe(iso);
  });

  test('drops records with impossible / out-of-range values', () => {
    const text = JSON.stringify({
      app: 'tabstyr',
      dailyStats: [
        { date: '2026-06-16', domain: 'a.com', seconds: 10, audioSeconds: 0 }, // valid
        { date: '2026-06-16', domain: 'a.com', seconds: -5, audioSeconds: 0 }, // negative → drop
        { date: '2026-06-16', domain: 'a.com', seconds: 10, audioSeconds: 99 }, // audio>seconds → drop
        { date: '2026/06/16', domain: 'a.com', seconds: 10, audioSeconds: 0 }, // bad date format → drop
        { date: '2026-06-16', domain: 'chrome', seconds: 10, audioSeconds: 0 }, // non-web domain → drop
      ],
      sessions: [
        { domain: 'a.com', url: 'https://a.com', start: 100, end: 200, audio: false }, // valid
        { domain: 'a.com', url: 'https://a.com', start: 200, end: 100, audio: false }, // end<start → drop
        { domain: 'a.com', url: 'https://a.com', start: 0, end: 100, audio: false }, // start not >0 → drop
      ],
    });
    const p = parseBackup(text);
    expect(p.dailyStats).toHaveLength(1);
    expect(p.sessions).toHaveLength(1);
  });

  test('rejects an oversized payload before parsing', () => {
    const huge = 'x'.repeat(MAX_BACKUP_BYTES + 1);
    expect(() => parseBackup(huge)).toThrow(/too large/i);
  });

  test('does not pollute Object.prototype via __proto__ in the backup JSON', () => {
    parseBackup('{"app":"tabstyr","__proto__":{"polluted":true}}');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test('rejects a settings object with an absurd key count', () => {
    const settings: Record<string, number> = {};
    for (let i = 0; i < 1001; i++) settings[`k${i}`] = i;
    expect(parseBackup(JSON.stringify({ app: 'tabstyr', settings })).settings).toBeUndefined();
  });

  test('rejects a backup from a newer schema version', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'tabstyr', schemaVersion: 999, dailyStats: [] }))).toThrow(
      /newer version/i,
    );
  });

  test('accepts current and legacy (missing / older) schema versions', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'tabstyr', schemaVersion: 2 }))).not.toThrow();
    expect(() => parseBackup(JSON.stringify({ app: 'tabstyr', schemaVersion: 1 }))).not.toThrow();
    expect(() => parseBackup(JSON.stringify({ app: 'tabstyr' }))).not.toThrow(); // pre-versioning file
  });

  test('round-trips a freshly written backup through the version guard', () => {
    expect(() => parseBackup(backupText())).not.toThrow();
  });
});

describe('restoreBackup', () => {
  test('replaces all data with the backup contents', async () => {
    // Seed some pre-existing data that restore must clear.
    await repo.applyDailyStats([{ date: '2020-01-01', domain: 'old.com', seconds: 999, audioSeconds: 0 }]);

    const res = await restoreBackup(parseBackup(backupText()));
    expect(res).toEqual({ dailyStats: 1, sessions: 1, tabMeta: 1 });

    const stats = await repo.getAllDailyStats();
    expect(stats).toEqual([{ date: '2026-06-16', domain: 'github.com', seconds: 120, audioSeconds: 0 }]);
    const metas = await repo.getAllTabMeta();
    expect(metas).toHaveLength(1);
    expect(metas[0].key).toBe('k1');
  });

  test('rolls back and keeps existing data when a write fails mid-restore', async () => {
    await repo.applyDailyStats([{ date: '2020-01-01', domain: 'old.com', seconds: 50, audioSeconds: 0 }]);
    // Two sessions sharing an explicit primary key → the second add() throws a
    // ConstraintError, aborting the single restore transaction. The clears must
    // roll back with it, leaving the pre-existing data intact.
    const dup = { domain: 'a.com', url: 'https://a.com', start: 1, end: 2, audio: false, tabKey: '', id: 1 };
    await expect(repo.restoreAll([dup as never, { ...dup } as never], [], [])).rejects.toBeTruthy();
    const stats = await repo.getAllDailyStats();
    expect(stats).toEqual([{ date: '2020-01-01', domain: 'old.com', seconds: 50, audioSeconds: 0 }]);
  });
});
