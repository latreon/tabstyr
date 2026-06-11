import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DailyStat, Session, TabMeta } from '../types';

interface TabTimeDB extends DBSchema {
  sessions: {
    key: number;
    value: Session & { id?: number };
    indexes: { 'by-start': number; 'by-tab': number };
  };
  dailyDomainStats: { key: [string, string]; value: DailyStat };
  tabMeta: { key: number; value: TabMeta };
}

let dbPromise: Promise<IDBPDatabase<TabTimeDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<TabTimeDB>> {
  dbPromise ??= openDB<TabTimeDB>('tab-time', 1, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        sessions.createIndex('by-start', 'start');
        sessions.createIndex('by-tab', 'tabId');
        db.createObjectStore('dailyDomainStats', { keyPath: ['date', 'domain'] });
        db.createObjectStore('tabMeta', { keyPath: 'tabId' });
      }
    },
    blocking(_currentVersion, _blockedVersion, _event) {
      // A newer version wants to open elsewhere (popup vs worker): release our hold.
      void dbPromise?.then((db) => db.close());
      dbPromise = null;
    },
  });
  return dbPromise;
}

/** Test hook: drop the cached connection so each test gets a fresh DB. */
export function resetDBConnection(): void {
  dbPromise = null;
}
