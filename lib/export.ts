import type { DailyStat, MonthlyStat, Session, Settings, TabMeta } from './types';

// JSON is the single, canonical export/restore format. It's the complete dataset
// (daily stats, the monthly rollup archive, raw sessions with URLs + timestamps,
// tab metadata, settings) and the only format the importer accepts.

export interface BackupData {
  dailyStats: DailyStat[];
  monthlyStats: MonthlyStat[];
  sessions: Session[];
  tabMeta: TabMeta[];
  settings: Settings;
}

// Backup file format version. Bump when the on-disk shape changes in a way that
// requires a migration on import. parseBackup() refuses files stamped with a
// HIGHER version than this build understands rather than importing them as
// partial garbage. The single source of truth for both the writer and reader.
// v3 adds monthlyStats (the pruned-day archive); older fields are unchanged, so a
// v2 backup restores fine (its monthlyStats is simply absent → []).
export const SCHEMA_VERSION = 3;

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

/** Trigger a client-side download of an existing Blob. DOM-only — call from a page. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Trigger a client-side download of `content`. DOM-only — call from a page. */
export function downloadFile(filename: string, content: string, mime: string): void {
  downloadBlob(filename, new Blob([content], { type: mime }));
}

// Excel decodes a CSV without a byte-order mark as the OS legacy codepage, so
// non-ASCII domains/category names render as mojibake. A leading UTF-8 BOM forces
// UTF-8. Kept out of the pure CSV builders (their output stays byte-exact for
// tests and re-use) — the BOM belongs to the download, not the data.
const UTF8_BOM = "\uFEFF";

/** Download a string as a UTF-8 CSV, BOM-prefixed so Excel reads non-ASCII correctly. */
export function downloadCsv(filename: string, csv: string): void {
  downloadFile(filename, UTF8_BOM + csv, 'text/csv;charset=utf-8');
}
