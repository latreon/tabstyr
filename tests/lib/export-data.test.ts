import { describe, expect, test } from 'vitest';
import { buildExportRows, exportRowsToCsv, exportRowsToJson } from '@/lib/export-data';
import { CATEGORY_PRODUCTIVITY } from '@/lib/categories';
import type { DailyStat, MonthlyStat } from '@/lib/types';

const daily = (date: string, domain: string, seconds: number, audioSeconds = 0): DailyStat => ({
  date,
  domain,
  seconds,
  audioSeconds,
});

const monthly = (month: string, domain: string, seconds: number, audioSeconds = 0): MonthlyStat => ({
  month,
  domain,
  seconds,
  audioSeconds,
});

const baseSettings = {
  categoryOverrides: {} as Record<string, string>,
  categoryRules: [],
  categoryProductivity: CATEGORY_PRODUCTIVITY,
  customCategories: [],
};

describe('buildExportRows', () => {
  test('subtracts audio from stored seconds to get active time, and reports audio separately', () => {
    // stored seconds is gross (foreground + background-audio); active = seconds - audioSeconds.
    const rows = buildExportRows([daily('2026-07-01', 'github.com', 700, 100)], [], baseSettings);
    expect(rows).toEqual([
      { period: '2026-07-01', granularity: 'day', domain: 'github.com', category: 'Dev', productivity: 'productive', activeSeconds: 600, activeHm: '0:10', audioSeconds: 100 },
    ]);
  });

  test('includes archived monthly rows alongside daily rows, tagged with their own granularity', () => {
    const rows = buildExportRows(
      [daily('2026-07-01', 'github.com', 600)],
      [monthly('2026-05', 'github.com', 1200)],
      baseSettings,
    );
    expect(rows.map((r) => r.granularity)).toEqual(['month', 'day']); // sorted by period asc
    expect(rows[0].period).toBe('2026-05');
  });

  test('drops non-web domains and fully-zero rows, but keeps audio-only rows', () => {
    const rows = buildExportRows(
      [
        daily('2026-07-01', 'newtab', 500), // non-web → excluded
        daily('2026-07-01', 'github.com', 0, 0), // fully zero → excluded
        daily('2026-07-01', 'youtube.com', 0, 120), // audio-only → kept
      ],
      [],
      baseSettings,
    );
    expect(rows.map((r) => r.domain)).toEqual(['youtube.com']);
    expect(rows[0]).toMatchObject({ activeSeconds: 0, audioSeconds: 120 });
  });

  test('respects category overrides and custom-category productivity', () => {
    const rows = buildExportRows(
      [daily('2026-07-01', 'example.com', 60)],
      [],
      {
        ...baseSettings,
        categoryOverrides: { 'example.com': 'DeepWork' },
        customCategories: [{ name: 'DeepWork', color: '#000', productivity: 'productive' }],
      },
    );
    expect(rows[0]).toMatchObject({ category: 'DeepWork', productivity: 'productive' });
  });

  test('sorts by period then domain', () => {
    const rows = buildExportRows(
      [daily('2026-07-01', 'zeta.com', 60), daily('2026-07-01', 'alpha.com', 60), daily('2026-06-30', 'omega.com', 60)],
      [],
      baseSettings,
    );
    expect(rows.map((r) => `${r.period}:${r.domain}`)).toEqual(['2026-06-30:omega.com', '2026-07-01:alpha.com', '2026-07-01:zeta.com']);
  });
});

describe('exportRowsToCsv', () => {
  test('emits a header and one row per entry', () => {
    const rows = buildExportRows([daily('2026-07-01', 'github.com', 3660)], [], baseSettings);
    const lines = exportRowsToCsv(rows).split('\r\n');
    expect(lines[0]).toBe('period,granularity,domain,category,productivity,active_seconds,active_hm,audio_seconds');
    expect(lines[1]).toBe('2026-07-01,day,github.com,Dev,productive,3660,1:01,0');
  });

  test('escapes fields containing commas or quotes in domain and category', () => {
    // A comma/quote can't appear in a real hostname, so isWebDomain would reject it —
    // exercise the CSV escaping directly against a hand-built row instead.
    const csv = exportRowsToCsv([
      { period: '2026-07-01', granularity: 'day', domain: 'a,b.com', category: 'My "fun" list', productivity: 'neutral', activeSeconds: 60, activeHm: '0:01', audioSeconds: 0 },
    ]);
    expect(csv).toContain('"a,b.com"');
    expect(csv).toContain('"My ""fun"" list"');
  });

  test('empty input yields just the header', () => {
    expect(exportRowsToCsv([])).toBe('period,granularity,domain,category,productivity,active_seconds,active_hm,audio_seconds');
  });
});

describe('exportRowsToJson', () => {
  test('wraps rows with app/exportedAt/rowCount metadata', () => {
    const rows = buildExportRows([daily('2026-07-01', 'github.com', 60)], [], baseSettings);
    const parsed = JSON.parse(exportRowsToJson(rows, Date.parse('2026-07-13T00:00:00.000Z')));
    expect(parsed.app).toBe('tabstyr');
    expect(parsed.exportedAt).toBe('2026-07-13T00:00:00.000Z');
    expect(parsed.rowCount).toBe(1);
    expect(parsed.rows).toEqual(rows);
  });
});
