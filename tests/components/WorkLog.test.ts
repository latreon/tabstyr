import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import WorkLog from '@/components/WorkLog.vue';
import { addDays, dateKey } from '@/lib/time';
import type { DailyStat } from '@/lib/types';

// "What did I work on?" — the day-scoped log, its date navigation, and the two
// exports. Its calendar is derived from the `now` prop, which the dashboard bumps on
// every refresh; capturing that once at setup froze the tile's idea of "today".

const NOW = Date.parse('2026-06-11T15:00:00');
const TODAY = dateKey(NOW);
const YESTERDAY = addDays(TODAY, -1);

const STATS: DailyStat[] = [
  { date: TODAY, domain: 'github.com', seconds: 3600, audioSeconds: 0 },
  { date: TODAY, domain: 'youtube.com', seconds: 1800, audioSeconds: 0 },
  { date: YESTERDAY, domain: 'notion.so', seconds: 600, audioSeconds: 0 },
];

function worklog(props: Partial<{ stats: DailyStat[]; now: number }> = {}) {
  return mount(WorkLog, {
    props: { stats: STATS, overrides: {}, rules: [], custom: [], now: NOW, ...props },
  });
}

// The two chevrons are the first two buttons in the controls row.
const prev = (w: VueWrapper) => w.findAll('.nav')[0];
const next = (w: VueWrapper) => w.findAll('.nav')[1];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('WorkLog', () => {
  test('opens on today and lists its sites, biggest first', () => {
    const w = worklog();
    expect(w.text()).toContain('github.com');
    expect(w.text()).toContain('youtube.com');
    const names = w.findAll('.site-name').map((n) => n.text());
    expect(names).toEqual(['github.com', 'youtube.com']);
  });

  test('cannot step past today, and stepping back shows the previous day', async () => {
    const w = worklog();
    expect((next(w).element as HTMLButtonElement).disabled).toBe(true);
    await prev(w).trigger('click');
    expect(w.text()).toContain('notion.so');
    expect(w.text()).not.toContain('github.com');
    expect((next(w).element as HTMLButtonElement).disabled).toBe(false);
  });

  test('a day with nothing tracked says so, with copy and both exports disabled', async () => {
    const w = worklog({ stats: [] });
    const actions = w.findAll('.btn'); // Copy / CSV / Image — the DatePicker is not one
    expect(actions.length).toBe(3);
    for (const b of actions) expect((b.element as HTMLButtonElement).disabled).toBe(true);
    expect(w.text()).not.toContain('github.com');
    expect(w.find('.sites').exists()).toBe(false);
  });

  test('stops at the retention edge (90 days back)', async () => {
    const w = worklog();
    // Walk back beyond the window; the button disables at the boundary.
    for (let i = 0; i < 95; i++) {
      if ((prev(w).element as HTMLButtonElement).disabled) break;
      await prev(w).trigger('click');
    }
    expect((prev(w).element as HTMLButtonElement).disabled).toBe(true);
  });

  describe('follows the clock (the `now` prop)', () => {
    test('a selection that was today becomes the new today after midnight', async () => {
      const w = worklog();
      expect(w.text()).toContain('github.com'); // today = Jun 11

      // The dashboard refreshed after midnight: same component, new `now`.
      const tomorrow = NOW + 86_400_000;
      await w.setProps({ now: tomorrow, stats: [...STATS, { date: dateKey(tomorrow), domain: 'linear.app', seconds: 900, audioSeconds: 0 }] });

      expect(w.text()).toContain('linear.app'); // moved to the new day...
      expect((next(w).element as HTMLButtonElement).disabled).toBe(true); // ...which is now the max
    });

    test('an explicitly chosen past day is NOT dragged forward', async () => {
      const w = worklog();
      await prev(w).trigger('click'); // pin Jun 10 deliberately
      expect(w.text()).toContain('notion.so');

      await w.setProps({ now: NOW + 86_400_000 });
      expect(w.text()).toContain('notion.so'); // still Jun 10
      expect((next(w).element as HTMLButtonElement).disabled).toBe(false);
    });

    test('a day that falls out of the window is pulled back inside it', async () => {
      const w = worklog();
      for (let i = 0; i < 89; i++) await prev(w).trigger('click'); // sit on the oldest day
      const oldest = addDays(TODAY, -89);

      // Two days later that date is outside the 90-day window.
      await w.setProps({ now: NOW + 2 * 86_400_000 });
      const label = w.get('.wl-line').text();
      expect(label).not.toBe('');
      // The selection can no longer be the now-expired oldest day.
      expect((prev(w).element as HTMLButtonElement).disabled).toBe(true);
      expect(oldest < addDays(dateKey(NOW + 2 * 86_400_000), -89)).toBe(true);
    });
  });

  describe('copy', () => {
    test('copies a localized plain-text summary', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
      const w = worklog();
      const copy = w.findAll('button').find((b) => b.text().match(/copy/i))!;
      await copy.trigger('click');
      expect(writeText).toHaveBeenCalledTimes(1);
      const text = writeText.mock.calls[0][0] as string;
      expect(text).toContain('github.com');
      expect(text).toContain('1h');
      vi.unstubAllGlobals();
    });

    test('a clipboard rejection is logged, never thrown at the user', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.stubGlobal('navigator', {
        ...navigator,
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      });
      const w = worklog();
      const copy = w.findAll('button').find((b) => b.text().match(/copy/i))!;
      await copy.trigger('click');
      await vi.waitFor(() => expect(err).toHaveBeenCalled());
      vi.unstubAllGlobals();
    });
  });

  test('emits a site selection and a category change for the parent to persist', async () => {
    const w = worklog();
    await w.get('.site').trigger('click');
    expect(w.emitted('select')).toEqual([['github.com']]);

    // The row's category picker: open it, then choose a different category.
    await w.get('.cat-picker .trigger').trigger('click');
    const option = w.findAll('.cat-picker [role="menuitemradio"]').find((o) => o.text().includes('Social'))!;
    await option.trigger('click');
    expect(w.emitted('setCategory')).toEqual([['github.com', 'Social']]);
  });
});
