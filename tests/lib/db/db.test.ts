import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';
import { getDB, resetDBConnection } from '@/lib/db/db';
import * as repo from '@/lib/db/repo';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDBConnection();
});

describe('getDB connection caching', () => {
  test('hands out one shared connection', async () => {
    expect(await getDB()).toBe(await getDB());
  });

  test('creates every store the app writes to', async () => {
    const db = await getDB();
    expect([...db.objectStoreNames].sort()).toEqual(
      ['dailyDomainStats', 'monthlyDomainStats', 'sessions', 'tabMeta'].sort(),
    );
  });

  test('the sessions store carries the indexes the readers rely on', async () => {
    const db = await getDB();
    const tx = db.transaction('sessions', 'readonly');
    expect([...tx.objectStore('sessions').indexNames].sort()).toEqual(['by-end', 'by-key', 'by-start', 'by-tab']);
    await tx.done;
  });

  test('recovers after the connection is closed out from under it', async () => {
    // The browser can close a connection unilaterally (user clears site data,
    // storage pressure, corruption). idb reports that via `terminated`, which drops
    // the cached promise — without it the cache kept handing out a dead connection
    // and every later read/write threw for the life of the page.
    const first = await getDB();
    first.close();
    resetDBConnection(); // stands in for the terminated callback firing
    const second = await getDB();
    expect(second).not.toBe(first);
    // And the reopened connection actually works.
    await expect(repo.getAllSessions()).resolves.toEqual([]);
  });
});
