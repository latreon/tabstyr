import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DailyStat, MonthlyStat, Session, TabMeta } from '../types';

interface TabTimeDB extends DBSchema {
  sessions: {
    key: number;
    value: Session & { id?: number };
    indexes: { 'by-start': number; 'by-tab': number; 'by-key': string };
  };
  dailyDomainStats: { key: [string, string]; value: DailyStat };
  // Long-range archive: per-domain monthly totals for days pruned out of the raw
  // 90-day window (see repo.pruneBefore). Keyed by [month, domain].
  monthlyDomainStats: { key: [string, string]; value: MonthlyStat };
  tabMeta: { key: number; value: TabMeta };
}

const DB_NAME = 'tab-time';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<TabTimeDB>> | null = null;

function blocking(): void {
  // A newer version wants to open elsewhere (popup vs worker): release our hold.
  void dbPromise?.then((db) => db.close());
  dbPromise = null;
}

function openAt(version: number | undefined): Promise<IDBPDatabase<TabTimeDB>> {
  return openDB<TabTimeDB>(DB_NAME, version, {
    upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        sessions.createIndex('by-start', 'start');
        sessions.createIndex('by-tab', 'tabId');
        db.createObjectStore('dailyDomainStats', { keyPath: ['date', 'domain'] });
        db.createObjectStore('tabMeta', { keyPath: 'tabId' });
      }
      if (oldVersion < 2) {
        // Stable per-tab attribution key. Pre-v2 sessions have no tabKey until the
        // one-time background migration backfills them (see backfillKeylessSessions).
        tx.objectStore('sessions').createIndex('by-key', 'tabKey');
      }
      if (oldVersion < 3) {
        // Monthly rollup archive. Created empty: existing raw days are archived
        // lazily as they age past the retention window in pruneBefore — never
        // pre-filled here (that would duplicate still-live daily rows).
        db.createObjectStore('monthlyDomainStats', { keyPath: ['month', 'domain'] });
      }
    },
    blocking,
  });
}

export function getDB(): Promise<IDBPDatabase<TabTimeDB>> {
  dbPromise ??= openAt(DB_VERSION).catch((e: unknown) => {
    // A stale, not-yet-evicted context (e.g. the previous build) may have opened a
    // newer version first. Don't crash — attach to whatever version now exists.
    if (e instanceof DOMException && e.name === 'VersionError') {
      dbPromise = openAt(undefined);
      return dbPromise;
    }
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

/** Test hook: drop the cached connection so each test gets a fresh DB. */
export function resetDBConnection(): void {
  dbPromise = null;
}
