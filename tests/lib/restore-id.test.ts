import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';
import { resetDBConnection } from '@/lib/db/db';
import * as repo from '@/lib/db/repo';
import { parseBackup, restoreBackup } from '@/lib/restore';
import type { Session } from '@/lib/types';

// Regression cover for the worst failure this codebase has had: an imported backup
// could permanently stop all tracking. `restoreAll` writes sessions with add(),
// which honours an inline `id` and advances the store's key generator to it. IndexedDB
// refuses to generate a key once that counter passes 2^53, so a single crafted (or
// corrupted) row made every future commit throw ConstraintError — silently, for good,
// until the user wiped their data. parseBackup must strip `id` on the way in.

const POISON_ID = 9_007_199_254_740_992; // 2^53

function backup(sessionExtras: Record<string, unknown>): string {
  return JSON.stringify({
    app: 'tabstyr',
    schemaVersion: 3,
    dailyStats: [],
    monthlyStats: [],
    tabMeta: [],
    sessions: [
      {
        tabKey: 'k',
        url: 'https://a.com/',
        domain: 'a.com',
        start: 1_700_000_000_000,
        end: 1_700_000_060_000,
        audio: false,
        ...sessionExtras,
      },
    ],
  });
}

const laterSession = (): Session => ({
  tabId: 1,
  tabKey: 'later',
  url: 'https://b.com/',
  domain: 'b.com',
  start: 1_700_000_100_000,
  end: 1_700_000_160_000,
  audio: false,
});

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDBConnection();
});

describe('parseBackup drops the local session id', () => {
  test('no `id` survives parsing, however large', () => {
    const parsed = parseBackup(backup({ id: POISON_ID }));
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.sessions[0]).not.toHaveProperty('id');
  });

  test('an ordinary id is dropped too — it is a local surrogate, not backup data', () => {
    const parsed = parseBackup(backup({ id: 42 }));
    expect(parsed.sessions[0]).not.toHaveProperty('id');
  });

  test('restoring a backup with a poisoned id leaves tracking working', async () => {
    await restoreBackup(parseBackup(backup({ id: POISON_ID })));
    // The real assertion: the very next commit must still succeed.
    await expect(repo.commitSessions([laterSession()], [])).resolves.toBeUndefined();
    expect(await repo.getAllSessions()).toHaveLength(2);
  });

  test('restore is unaffected by a non-numeric id', async () => {
    await restoreBackup(parseBackup(backup({ id: 'not-a-key' })));
    await expect(repo.commitSessions([laterSession()], [])).resolves.toBeUndefined();
  });
});
