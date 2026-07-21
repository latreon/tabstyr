import { describe, expect, test, vi } from 'vitest';
import { downloadCsv, toJsonBackup } from '@/lib/export';
import { CATEGORY_PRODUCTIVITY } from '@/lib/categories';
import type { Settings } from '@/lib/types';

const SETTINGS: Settings = { staleDays: 3, idleSeconds: 60, audioEnabled: true, theme: 'system', customCategories: [], categoryOverrides: {}, categoryRules: [], categoryProductivity: { ...CATEGORY_PRODUCTIVITY }, focusTarget: 50, categoryBudgets: {}, onboarded: false, notificationsEnabled: true, sessionAlertMinutes: 30, language: 'auto', autoExportDays: 0 };

describe('toJsonBackup', () => {
  test('produces parseable JSON with metadata and all sections', () => {
    const now = Date.UTC(2026, 5, 12, 8, 0, 0);
    const json = toJsonBackup(
      { dailyStats: [], monthlyStats: [], sessions: [], tabMeta: [], settings: SETTINGS },
      now,
    );
    const parsed = JSON.parse(json);
    expect(parsed.app).toBe('tabstyr');
    expect(parsed.schemaVersion).toBe(3);
    expect(parsed.exportedAt).toBe('2026-06-12T08:00:00.000Z');
    expect(parsed.settings).toEqual(SETTINGS);
    expect(Array.isArray(parsed.sessions)).toBe(true);
  });
});

describe('downloadCsv', () => {
  test('prefixes a UTF-8 BOM so Excel decodes non-ASCII correctly', async () => {
    // Capture the Blob handed to the browser; noop the anchor click so no navigation fires.
    let captured: Blob | undefined;
    if (!URL.createObjectURL) (URL as unknown as { createObjectURL: unknown }).createObjectURL = () => '';
    if (!URL.revokeObjectURL) (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = () => {};
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      captured = blob as Blob;
      return 'blob:mock';
    });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsv('data.csv', 'period,domain\r\n2026-07-01,café.com');

    expect(captured).toBeDefined();
    const text = await captured!.text();
    expect(text.charCodeAt(0)).toBe(0xfeff); // leading BOM
    expect(text.slice(1)).toBe('period,domain\r\n2026-07-01,café.com'); // data unchanged after BOM
    expect(captured!.type).toContain('text/csv');
    create.mockRestore();
    revoke.mockRestore();
    click.mockRestore();
  });
});
