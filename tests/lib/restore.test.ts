import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';
import { resetDBConnection } from '@/lib/db/db';
import * as repo from '@/lib/db/repo';
import { parseBackup, restoreBackup, MAX_BACKUP_BYTES } from '@/lib/restore';
import { toJsonBackup } from '@/lib/export';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import type { Session } from '@/lib/types';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDBConnection();
});

const backupText = () =>
  toJsonBackup(
    {
      dailyStats: [{ date: '2026-06-16', domain: 'github.com', seconds: 120, audioSeconds: 0 }],
      monthlyStats: [{ month: '2026-03', domain: 'github.com', seconds: 5000, audioSeconds: 0 }],
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

  test('drops impossible calendar dates and months', () => {
    const parsed = parseBackup(JSON.stringify({
      app: 'tabstyr',
      dailyStats: [
        { date: '2026-02-31', domain: 'a.com', seconds: 10, audioSeconds: 0 },
        { date: '2026-02-28', domain: 'a.com', seconds: 10, audioSeconds: 0 },
      ],
      monthlyStats: [
        { month: '2026-13', domain: 'a.com', seconds: 10, audioSeconds: 0 },
        { month: '2026-12', domain: 'a.com', seconds: 10, audioSeconds: 0 },
      ],
    }));
    expect(parsed.dailyStats.map((s) => s.date)).toEqual(['2026-02-28']);
    expect(parsed.monthlyStats.map((s) => s.month)).toEqual(['2026-12']);
  });

  test('drops metadata with invalid browser tab ids', () => {
    const base = { key: 'k', url: 'https://a.com', title: 'A', lastActiveAt: 1, createdAt: 1 };
    const parsed = parseBackup(JSON.stringify({ app: 'tabstyr', tabMeta: [
      { ...base, tabId: -1 }, { ...base, tabId: 1.5 }, { ...base, tabId: 2 },
    ] }));
    expect(parsed.tabMeta.map((m) => m.tabId)).toEqual([2]);
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
    expect(parsed.sessions[0]!.tabKey).toBe('ok');
    expect(parsed.sessions[1]!.tabKey).toBe('');
  });

  test('re-derives a session domain from its url so a spoofed domain cannot survive', () => {
    const text = JSON.stringify({
      app: 'tabstyr',
      sessions: [
        // Crafted: a trusted-looking domain paired with an unrelated url.
        { tabKey: 'k', domain: 'wikipedia.org', url: 'https://attacker.example/x', start: 1, end: 2, audio: false },
      ],
    });
    const parsed = parseBackup(text);
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.sessions[0]!.domain).toBe('attacker.example'); // bound to the url, not the claim
    expect(parsed.sessions[0]!.url).toBe('https://attacker.example/x');
  });

  test('drops a session whose url is not a real web page even if domain claims otherwise', () => {
    const text = JSON.stringify({
      app: 'tabstyr',
      sessions: [
        { tabKey: 'k', domain: 'github.com', url: 'file:///etc/passwd', start: 1, end: 2, audio: false },
      ],
    });
    // The url rebinds to the non-web 'file' bucket → dropped rather than mis-stored.
    expect(parseBackup(text).sessions).toHaveLength(0);
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

  test('strips query/fragment from imported session and tabMeta urls', () => {
    const text = JSON.stringify({
      app: 'tabstyr',
      sessions: [
        { domain: 'a.com', url: 'https://a.com/p?token=secret#x', start: 1, end: 2, audio: false },
      ],
      tabMeta: [
        { tabId: 1, key: 'k', url: 'https://a.com/p?token=secret', title: 'A', lastActiveAt: 1, createdAt: 1 },
      ],
    });
    const p = parseBackup(text);
    expect(p.sessions[0]!.url).toBe('https://a.com/p');
    expect(p.tabMeta[0]!.url).toBe('https://a.com/p');
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
    await repo.commitSessions([], [{ date: '2020-01-01', domain: 'old.com', seconds: 999, audioSeconds: 0 }]);

    const res = await restoreBackup(parseBackup(backupText()));
    expect(res).toEqual({ dailyStats: 1, monthlyStats: 1, sessions: 1, tabMeta: 1 });

    const stats = await repo.getAllDailyStats();
    expect(stats).toEqual([{ date: '2026-06-16', domain: 'github.com', seconds: 120, audioSeconds: 0 }]);
    const monthly = await repo.getAllMonthlyStats();
    expect(monthly).toEqual([{ month: '2026-03', domain: 'github.com', seconds: 5000, audioSeconds: 0 }]);
    const metas = await repo.getAllTabMeta();
    expect(metas).toHaveLength(1);
    expect(metas[0]!.key).toBe('k1');
  });

  test('rolls back and keeps existing data when a write fails mid-restore', async () => {
    await repo.commitSessions([], [{ date: '2020-01-01', domain: 'old.com', seconds: 50, audioSeconds: 0 }]);
    // Two sessions sharing an explicit primary key → the second add() throws a
    // ConstraintError, aborting the single restore transaction. The clears must
    // roll back with it, leaving the pre-existing data intact.
    const dup = { domain: 'a.com', url: 'https://a.com', start: 1, end: 2, audio: false, tabKey: '', id: 1 };
    await expect(repo.restoreAll([dup as never, { ...dup } as never], [], [])).rejects.toBeTruthy();
    const stats = await repo.getAllDailyStats();
    expect(stats).toEqual([{ date: '2020-01-01', domain: 'old.com', seconds: 50, audioSeconds: 0 }]);
  });
});

describe('backup files end to end', () => {
  const session = (start: number, tabKey = 'k1') => ({ tabId: 1, tabKey, url: 'https://github.com/', domain: 'github.com', start, end: start + 60_000, audio: false });
  const stat = { date: '2026-06-16', domain: 'github.com', seconds: 120, audioSeconds: 0 };

  test('export then restore gives back exactly the stored data', async () => {
    await repo.commitSessions([session(1_000), session(100_000)], [stat]);
    await repo.upsertTabMeta({ tabId: 1, key: 'k1', url: 'https://github.com/', title: 'GH', lastActiveAt: 1, createdAt: 1 });
    const before = { sessions: await repo.getAllSessions(), dailyStats: await repo.getAllDailyStats(), tabMeta: await repo.getAllTabMeta() };
    const file = toJsonBackup({ ...before, monthlyStats: [], settings: DEFAULT_SETTINGS }, Date.now());

    await repo.wipeAll();
    await restoreBackup(parseBackup(file));

    const strip = (rows: (Session & { id?: number })[]) => rows.map(({ id: _id, ...rest }) => rest);
    expect(strip(await repo.getAllSessions())).toEqual(strip(before.sessions));
    expect(await repo.getAllDailyStats()).toEqual(before.dailyStats);
    expect(await repo.getAllTabMeta()).toEqual(before.tabMeta);
  });

  test('a v1 file (no monthly archive, sessions without a tab key) restores', async () => {
    const v1 = {
      app: 'tabstyr',
      schemaVersion: 1,
      exportedAt: '2026-06-16T10:00:00.000Z',
      dailyStats: [stat],
      sessions: [{ tabId: 1, url: 'https://github.com/', domain: 'github.com', start: 1_000, end: 61_000, audio: false }],
      tabMeta: [],
    };

    const counts = await restoreBackup(parseBackup(JSON.stringify(v1)));

    expect(counts).toEqual({ dailyStats: 1, monthlyStats: 0, sessions: 1, tabMeta: 0 });
    expect(await repo.getAllMonthlyStats()).toEqual([]);
  });

  test('a file with only daily totals restores those and clears the rest', async () => {
    await repo.commitSessions([session(1_000)], []);

    await restoreBackup(parseBackup(JSON.stringify({ app: 'tabstyr', schemaVersion: 3, dailyStats: [stat] })));

    expect(await repo.getAllDailyStats()).toEqual([stat]);
    expect(await repo.getAllSessions()).toEqual([]);
  });

  test('a large file (100k sessions) parses in reasonable time', () => {
    const sessions = Array.from({ length: 100_000 }, (_, i) => session(1_000 + i * 120_000, `k${i % 50}`));
    const file = JSON.stringify({ app: 'tabstyr', schemaVersion: 3, sessions });

    const startedAt = performance.now();
    expect(parseBackup(file).sessions).toHaveLength(100_000);
    expect(performance.now() - startedAt).toBeLessThan(5_000);
  });

  test('the same session listed twice is stored once', async () => {
    const file = JSON.stringify({ app: 'tabstyr', schemaVersion: 3, sessions: [session(1_000), session(1_000)] });

    await restoreBackup(parseBackup(file));

    expect(await repo.getAllSessions()).toHaveLength(1);
  });
});
