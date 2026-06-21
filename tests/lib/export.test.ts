import { describe, expect, test } from 'vitest';
import { dailyStatsToCsv, sessionsToCsv, toJsonBackup } from '@/lib/export';
import type { DailyStat, Session, Settings } from '@/lib/types';

const SETTINGS: Settings = { staleDays: 3, idleSeconds: 60, audioEnabled: true, theme: 'system', categoryOverrides: {}, categoryRules: [], onboarded: false, notificationsEnabled: true, language: 'auto' };

describe('dailyStatsToCsv', () => {
  test('emits a header and one row per stat, sorted by date then domain', () => {
    const stats: DailyStat[] = [
      { date: '2026-06-12', domain: 'b.com', seconds: 30, audioSeconds: 0 },
      { date: '2026-06-11', domain: 'z.com', seconds: 20, audioSeconds: 5 },
      { date: '2026-06-11', domain: 'a.com', seconds: 10, audioSeconds: 0 },
    ];
    const csv = dailyStatsToCsv(stats);
    expect(csv.split('\n')).toEqual([
      'date,domain,seconds,audio_seconds',
      '2026-06-11,a.com,10,0',
      '2026-06-11,z.com,20,5',
      '2026-06-12,b.com,30,0',
    ]);
  });

  test('escapes cells containing commas or quotes', () => {
    const csv = dailyStatsToCsv([{ date: '2026-06-11', domain: 'a,"b".com', seconds: 1, audioSeconds: 0 }]);
    expect(csv.split('\n')[1]).toBe('2026-06-11,"a,""b"".com",1,0');
  });

  test('neutralizes spreadsheet formula injection in the domain cell', () => {
    const csv = dailyStatsToCsv([{ date: '2026-06-11', domain: '=cmd|/c calc', seconds: 1, audioSeconds: 0 }]);
    // leading "=" prefixed with ' so the spreadsheet treats it as text (no comma → unquoted)
    expect(csv.split('\n')[1]).toBe(`2026-06-11,'=cmd|/c calc,1,0`);
  });

  test('quotes AND prefixes when a formula lead also contains a separator', () => {
    const csv = dailyStatsToCsv([{ date: '2026-06-11', domain: '=a,b', seconds: 1, audioSeconds: 0 }]);
    expect(csv.split('\n')[1]).toBe(`2026-06-11,"'=a,b",1,0`);
  });

  test('prefixes other formula-trigger leads (+, -, @) without altering safe values', () => {
    const csv = dailyStatsToCsv([
      { date: '2026-06-11', domain: '@x.com', seconds: 1, audioSeconds: 0 },
      { date: '2026-06-12', domain: 'safe.com', seconds: 2, audioSeconds: 0 },
    ]).split('\n');
    expect(csv[1]).toBe(`2026-06-11,'@x.com,1,0`);
    expect(csv[2]).toBe('2026-06-12,safe.com,2,0');
  });
});

describe('sessionsToCsv', () => {
  test('emits ISO timestamps and rounded seconds', () => {
    const start = Date.UTC(2026, 5, 11, 10, 0, 0);
    const sessions: Session[] = [
      { tabId: 1, tabKey: 'k1', url: 'https://a.com', domain: 'a.com', start, end: start + 90_000, audio: false },
    ];
    const rows = sessionsToCsv(sessions).split('\n');
    expect(rows[0]).toBe('date,start_iso,end_iso,seconds,domain,audio,tab_key');
    expect(rows[1]).toContain('2026-06-11T10:00:00.000Z');
    expect(rows[1]).toContain(',90,a.com,0,k1');
  });
});

describe('toJsonBackup', () => {
  test('produces parseable JSON with metadata and all sections', () => {
    const now = Date.UTC(2026, 5, 12, 8, 0, 0);
    const json = toJsonBackup(
      { dailyStats: [], sessions: [], tabMeta: [], settings: SETTINGS },
      now,
    );
    const parsed = JSON.parse(json);
    expect(parsed.app).toBe('tabstyr');
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.exportedAt).toBe('2026-06-12T08:00:00.000Z');
    expect(parsed.settings).toEqual(SETTINGS);
    expect(Array.isArray(parsed.sessions)).toBe(true);
  });
});
