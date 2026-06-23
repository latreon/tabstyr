import type { DailyStat, Session, Settings, TabMeta } from './types';

// JSON is the single, canonical export/restore format. It's the complete dataset
// (daily stats, raw sessions with URLs + timestamps, tab metadata, settings) and
// the only format the importer accepts.

export interface BackupData {
  dailyStats: DailyStat[];
  sessions: Session[];
  tabMeta: TabMeta[];
  settings: Settings;
}

// Backup file format version. Bump when the on-disk shape changes in a way that
// requires a migration on import. parseBackup() refuses files stamped with a
// HIGHER version than this build understands rather than importing them as
// partial garbage. The single source of truth for both the writer and reader.
export const SCHEMA_VERSION = 2;

/** Full, restorable JSON backup. `now` is passed in so the builder stays pure. */
export function toJsonBackup(data: BackupData, now: number): string {
  return JSON.stringify(
    {
      app: 'tabstyr',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date(now).toISOString(),
      ...data,
    },
    null,
    2,
  );
}

/** Trigger a client-side download of `content`. DOM-only — call from a page. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
