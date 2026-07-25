import { afterEach, describe, expect, test } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import DomainDetail from '@/components/DomainDetail.vue';
import { CATEGORY_PRODUCTIVITY } from '@/lib/categories';
import type { DailyStat, Session } from '@/lib/types';

const NOW = new Date(2026, 5, 11, 12, 0).getTime();
const DATE = '2026-06-11';

const stat = (p: Partial<DailyStat> = {}): DailyStat =>
  ({ date: DATE, domain: 'a.com', seconds: 600, audioSeconds: 0, ...p });
const session = (p: Partial<Session> = {}): Session =>
  ({ tabId: 1, tabKey: 'k', url: 'https://a.com/x', domain: 'a.com', start: NOW - 600_000, end: NOW - 540_000, audio: false, ...p });

let wrapper: VueWrapper | null = null;
function makeWrapper(stats: DailyStat[], sessions: Session[]) {
  wrapper = mount(DomainDetail, {
    props: {
      domain: 'a.com',
      stats,
      sessions,
      now: NOW,
      overrides: {},
      rules: [],
      custom: [],
      productivity: { ...CATEGORY_PRODUCTIVITY },
    },
  });
  return wrapper;
}
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = '';
});

/** metric label → value, read from the teleported panel. */
function metrics(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of document.querySelectorAll('.stat')) {
    const label = node.querySelector('.stat-label')?.textContent?.trim() ?? '';
    out[label] = node.querySelector('.stat-value')?.textContent?.trim() ?? '';
  }
  return out;
}

describe('DomainDetail visit metrics', () => {
  test('averages over the VISITS, not the daily-stats total ÷ visit count', () => {
    // Two 60s visits (heartbeat slices stitched), well apart in time.
    makeWrapper(
      [stat({ seconds: 600 })], // daily total deliberately larger than the sessions
      [
        session({ start: NOW - 600_000, end: NOW - 540_000 }),
        session({ start: NOW - 120_000, end: NOW - 60_000 }),
      ],
    );
    const m = metrics();
    expect(m['Sessions']).toBe('2');
    // 120s of visits over 2 visits = 60s. The old formula (600 ÷ 2 = 300s) reported
    // an average bigger than the longest visit, which is impossible.
    expect(m['Avg session']).toBe('1m');
    expect(m['Longest session']).toBe('1m');
  });

  test('adjacent heartbeat slices stitch into one visit', () => {
    makeWrapper([stat({ seconds: 180 })], [
      session({ start: NOW - 180_000, end: NOW - 120_000 }),
      session({ start: NOW - 120_000, end: NOW - 60_000 }),
      session({ start: NOW - 60_000, end: NOW }),
    ]);
    expect(metrics()['Sessions']).toBe('1');
    expect(metrics()['Longest session']).toBe('3m');
  });

  test('with imported-only data (no sessions) the visit rows are hidden, not zeroed', () => {
    // A CSV import writes daily estimates with no backing sessions. Showing
    // "Visits 0 / Avg 0s" beside a real total reads as a bug.
    makeWrapper([stat({ seconds: 600 })], []);
    const m = metrics();
    expect(m['Sessions']).toBeUndefined();
    expect(m['Avg session']).toBeUndefined();
    expect(m['Longest session']).toBeUndefined();
    // The totals that DO come from daily stats are still shown.
    expect(m['Total (90d)']).toBe('10m');
    expect(m['Active days']).toBe('1');
  });

  test('audio time only appears when there is some', () => {
    makeWrapper([stat({ seconds: 600, audioSeconds: 0 })], [session()]);
    expect(metrics()['Audio']).toBeUndefined();
    wrapper?.unmount();
    document.body.innerHTML = '';
    makeWrapper([stat({ seconds: 600, audioSeconds: 120 })], [session()]);
    expect(metrics()['Audio']).toBe('2m');
  });
});

describe('DomainDetail shell', () => {
  test('is a labelled modal dialog that locks page scroll', () => {
    makeWrapper([stat()], [session()]);
    const panel = document.querySelector('[role="dialog"]');
    expect(panel?.getAttribute('aria-modal')).toBe('true');
    expect(panel?.getAttribute('aria-label')).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
  });

  test('Escape emits close', () => {
    const w = makeWrapper([stat()], [session()]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(w.emitted('close')).toBeTruthy();
  });

  test('share of all tracked time is computed against the whole stats set', () => {
    makeWrapper([stat({ seconds: 300 }), stat({ domain: 'b.com', seconds: 100 })], [session()]);
    expect(metrics()['Share of all time']).toBe('75%'); // 300 / 400
  });
});
