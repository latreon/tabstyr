import { dateKey } from './time';
import type { DailyStat, Session, Settings, TabMeta } from './types';

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRows(header: string[], rows: Array<Array<string | number>>): string {
  return [header, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n');
}

/** Daily per-domain totals — the most human-useful spreadsheet view. */
export function dailyStatsToCsv(stats: DailyStat[]): string {
  const sorted = [...stats].sort((a, b) => a.date.localeCompare(b.date) || a.domain.localeCompare(b.domain));
  return csvRows(
    ['date', 'domain', 'seconds', 'audio_seconds'],
    sorted.map((s) => [s.date, s.domain, s.seconds, s.audioSeconds]),
  );
}

/** Raw session log — one row per tracked interval, ISO timestamps. */
export function sessionsToCsv(sessions: Session[]): string {
  const sorted = [...sessions].sort((a, b) => a.start - b.start);
  return csvRows(
    ['date', 'start_iso', 'end_iso', 'seconds', 'domain', 'audio', 'tab_key'],
    sorted.map((s) => [
      dateKey(s.start),
      new Date(s.start).toISOString(),
      new Date(s.end).toISOString(),
      Math.round((s.end - s.start) / 1000),
      s.domain,
      s.audio ? 1 : 0,
      s.tabKey ?? '',
    ]),
  );
}

export interface BackupData {
  dailyStats: DailyStat[];
  sessions: Session[];
  tabMeta: TabMeta[];
  settings: Settings;
}

/** Full, restorable JSON backup. `now` is passed in so the builder stays pure. */
export function toJsonBackup(data: BackupData, now: number): string {
  return JSON.stringify(
    {
      app: 'tabtelo',
      schemaVersion: 2,
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
