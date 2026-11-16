import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
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

describe('upgrading a database left by an older build', () => {
  const session = { tabId: 3, url: 'https://a.com/', domain: 'a.com', start: 1_000, end: 61_000, audio: false };
  const stat = { date: '2026-06-01', domain: 'a.com', seconds: 60, audioSeconds: 0 };
  const meta = { tabId: 3, key: 'k3', url: 'https://a.com/', title: 'A', lastActiveAt: 1, createdAt: 1 };

  // Recreate the exact schema each released version shipped, with some data in it.
  async function seedVersion(version: 1 | 2 | 3) {
    const db = await openDB('tab-time', version, {
      upgrade(raw) {
        const sessions = raw.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        sessions.createIndex('by-start', 'start');
        sessions.createIndex('by-tab', 'tabId');
        if (version >= 2) sessions.createIndex('by-key', 'tabKey');
        raw.createObjectStore('dailyDomainStats', { keyPath: ['date', 'domain'] });
        raw.createObjectStore('tabMeta', { keyPath: 'tabId' });
        if (version >= 3) raw.createObjectStore('monthlyDomainStats', { keyPath: ['month', 'domain'] });
      },
    });
    await db.add('sessions', version >= 2 ? { ...session, tabKey: 'k3' } : session);
    await db.put('dailyDomainStats', stat);
    await db.put('tabMeta', meta);
    db.close();
  }

  test.each([1, 2, 3] as const)('v%i keeps all data and gains the current stores and indexes', async (version) => {
    await seedVersion(version);

    const db = await getDB();

    expect(db.version).toBe(4);
    expect([...db.objectStoreNames].sort()).toEqual(['dailyDomainStats', 'monthlyDomainStats', 'sessions', 'tabMeta']);
    const tx = db.transaction('sessions', 'readonly');
    expect([...tx.objectStore('sessions').indexNames].sort()).toEqual(['by-end', 'by-key', 'by-start', 'by-tab']);
    await tx.done;
    expect(await repo.getSessionsSince(0)).toEqual([expect.objectContaining(session)]);
    expect(await repo.getStatsRange('2026-06-01', '2026-06-01')).toEqual([stat]);
    expect(await repo.getAllTabMeta()).toEqual([meta]);
  });

  test('attaches to a newer database another context already upgraded', async () => {
    const newer = await openDB('tab-time', 9, {
      upgrade(raw) {
        raw.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true }).createIndex('by-start', 'start');
      },
    });
    newer.close();

    expect((await getDB()).version).toBe(9);
  });
});
