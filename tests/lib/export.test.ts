import { describe, expect, test } from 'vitest';
import { toJsonBackup } from '@/lib/export';
import { CATEGORY_PRODUCTIVITY } from '@/lib/categories';
import type { Settings } from '@/lib/types';

const SETTINGS: Settings = { staleDays: 3, idleSeconds: 60, audioEnabled: true, theme: 'system', customCategories: [], categoryOverrides: {}, categoryRules: [], categoryProductivity: { ...CATEGORY_PRODUCTIVITY }, focusTarget: 50, categoryBudgets: {}, onboarded: false, notificationsEnabled: true, sessionAlertMinutes: 30, language: 'auto', excludedDomains: [], trackingPaused: false, domainAliases: {}, autoExportDays: 0 };

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
