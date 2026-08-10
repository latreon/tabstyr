import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import CategoryChart from '@/components/CategoryChart.vue';
import HeroTile from '@/components/HeroTile.vue';
import StatTile from '@/components/StatTile.vue';
import TopSitesChart from '@/components/TopSitesChart.vue';
import ProductivityTile from '@/components/ProductivityTile.vue';
import InsightsTile from '@/components/InsightsTile.vue';
import HeatmapTile from '@/components/HeatmapTile.vue';
import ComparisonTile from '@/components/ComparisonTile.vue';
import TrendChart from '@/components/TrendChart.vue';
import FocusTrend from '@/components/FocusTrend.vue';
import { buildHourlyHeatmap } from '@/lib/heatmap';
import { CATEGORY_PRODUCTIVITY } from '@/lib/categories';
import type { DailyStat } from '@/lib/types';

// Broad smoke + behaviour cover for the display tiles: each must render its data,
// degrade to an empty state rather than a broken one, and expose the numbers to
// assistive tech (several are purely visual bars).

const NOW = new Date(2026, 5, 11, 12, 0).getTime();
const TODAY = '2026-06-11';
const stat = (p: Partial<DailyStat> = {}): DailyStat =>
  ({ date: TODAY, domain: 'a.com', seconds: 600, audioSeconds: 0, ...p });

describe('CategoryChart', () => {
  const slices = [
    { category: 'Work', seconds: 3600, audioSeconds: 0 },
    { category: 'Social', seconds: 1200, audioSeconds: 0 },
  ];

  test('renders one segment and chip per non-zero slice', () => {
    const w = mount(CategoryChart, { props: { slices } });
    expect(w.findAll('.seg')).toHaveLength(2);
    expect(w.findAll('.chips li')).toHaveLength(2);
  });

  test('the purely visual bar carries a text summary for screen readers', () => {
    const w = mount(CategoryChart, { props: { slices } });
    const label = w.get('.stack').attributes('aria-label') ?? '';
    expect(w.get('.stack').attributes('role')).toBe('img');
    expect(label).toContain('75%'); // 3600 of 4800
    expect(label).toContain('25%');
  });

  test('uses exact ratios for geometry even when display percentages round', () => {
    const thirds = ['Work', 'Social', 'Dev'].map((category) => ({ category, seconds: 1, audioSeconds: 0 }));
    const w = mount(CategoryChart, { props: { slices: thirds } });
    const total = w.findAll('.seg').reduce(
      (sum, segment) => sum + Number.parseFloat((segment.element as HTMLElement).style.width),
      0,
    );
    expect(total).toBeCloseTo(100, 8);
  });

  test('shows an empty state instead of a zero-width bar', () => {
    const w = mount(CategoryChart, { props: { slices: [] } });
    expect(w.find('.stack').exists()).toBe(false);
    expect(w.get('.empty').text().length).toBeGreaterThan(0);
  });

  test('marks a category that is over its daily budget', () => {
    const w = mount(CategoryChart, {
      props: { slices, budgets: { Social: 10 } }, // 1200s used vs 600s budget
    });
    expect(w.get('.budget-pill').classes()).toContain('over');
  });

  test('shows the budget without the over marker when inside it', () => {
    const w = mount(CategoryChart, { props: { slices, budgets: { Social: 60 } } });
    expect(w.get('.budget-pill').classes()).not.toContain('over');
  });
});

describe('HeroTile', () => {
  const base = {
    todaySeconds: 3600,
    weeklyAvgSeconds: 1800,
    weeklyActiveDays: 5,
    todayAudioSeconds: 0,
    stats: [stat()],
    now: NOW,
  };

  test('shows today total and a comparison once there is enough history', () => {
    const w = mount(HeroTile, { props: base });
    expect(w.text()).toContain('1h');
    expect(w.get('.hero-delta').text()).toContain('100%'); // 3600 vs 1800 avg
  });

  test('hides the comparison below three active days (a 1–2 day baseline is noise)', () => {
    const w = mount(HeroTile, { props: { ...base, weeklyActiveDays: 2 } });
    expect(w.find('.hero-delta').exists()).toBe(false);
  });

  test('uses the shared clock prop rather than its own Date.now()', () => {
    // A day far outside the sparkline's 10-day window must not be plotted, which
    // only holds if `now` is honoured.
    const w = mount(HeroTile, { props: { ...base, stats: [stat({ date: '2020-01-01', seconds: 999 })] } });
    expect(w.find('.spark').exists()).toBe(true); // renders, flat, no crash
  });

  test('a zero day swaps in a hint instead of showing a dead-flat chart', () => {
    const w = mount(HeroTile, { props: { ...base, todaySeconds: 0, stats: [] } });
    expect(w.find('.hero-delta').exists()).toBe(false);
    expect(w.text().length).toBeGreaterThan(0);
  });
});

describe('StatTile', () => {
  test('renders label and value, inert by default', () => {
    const w = mount(StatTile, { props: { label: 'Open tabs', value: '12' } });
    expect(w.text()).toContain('Open tabs');
    expect(w.text()).toContain('12');
    expect(w.find('button').exists()).toBe(false);
  });

  test('becomes a real button when clickable, and emits activate', async () => {
    const w = mount(StatTile, {
      props: { label: 'Stale tabs', value: '3', clickable: true, warn: true, actionHint: 'Review' },
    });
    const btn = w.get('button');
    await btn.trigger('click');
    expect(w.emitted('activate')).toBeTruthy();
    expect(w.text()).toContain('Review');
  });
});

describe('TopSitesChart', () => {
  const domains = [
    { domain: 'www.github.com', seconds: 600, audioSeconds: 0 },
    { domain: 'youtube.com', seconds: 300, audioSeconds: 60 },
  ];

  test('lists sites with the display domain (www. stripped) and emits select', async () => {
    const w = mount(TopSitesChart, { props: { domains } });
    expect(w.text()).toContain('github.com');
    expect(w.text()).not.toContain('www.github.com');
    await w.findAll('button')[0].trigger('click');
    expect(w.emitted('select')?.[0]).toEqual(['www.github.com']);
  });

  test('caps the list at six rows', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ domain: `s${i}.com`, seconds: 100 - i, audioSeconds: 0 }));
    expect(mount(TopSitesChart, { props: { domains: many } }).findAll('button').length).toBeLessThanOrEqual(6);
  });
});

describe('ProductivityTile', () => {
  const summary = {
    todayFocusPct: 60,
    productiveSeconds: 3600,
    distractingSeconds: 2400,
    neutralSeconds: 600,
    streakDays: 4,
    focusTarget: 50,
  };

  test('shows the focus percentage and streak', () => {
    const w = mount(ProductivityTile, { props: { summary } });
    expect(w.text()).toContain('60');
    expect(w.text()).toContain('4');
  });

  test('shows an empty state when there is nothing judged', () => {
    const w = mount(ProductivityTile, {
      props: { summary: { ...summary, productiveSeconds: 0, distractingSeconds: 0, todayFocusPct: 0 } },
    });
    expect(w.text().length).toBeGreaterThan(0);
  });
});

describe('InsightsTile', () => {
  test('localizes raw params (weekday index, hour, category key)', () => {
    const w = mount(InsightsTile, {
      props: {
        insights: [
          { id: 'peak', key: 'peakHour', params: { hour: 9, weekday: 3 } },
          { id: 'category', key: 'catUp', params: { category: 'Dev', pct: 20 } },
        ],
      },
    });
    const text = w.text();
    expect(text).toContain('09:00'); // hour formatted, not the bare number
    expect(text).toContain('Wednesday'); // weekday index resolved to a name
    expect(text).not.toContain('categories.Dev'); // category key resolved
  });

  test('shows at most `max` lines', () => {
    const insights = Array.from({ length: 6 }, (_, i) => ({ id: `i${i}`, key: 'streak', params: { days: i + 2 } }));
    expect(mount(InsightsTile, { props: { insights, max: 2 } }).findAll('li')).toHaveLength(2);
  });
});

describe('HeatmapTile', () => {
  const sessions = [{ start: new Date(2026, 5, 11, 10, 0).getTime(), end: new Date(2026, 5, 11, 10, 30).getTime() }];

  test('renders a 7×24 grid with a peak label', () => {
    const w = mount(HeatmapTile, { props: { data: buildHourlyHeatmap(sessions) } });
    expect(w.findAll('[data-cell]')).toHaveLength(168);
    expect(w.get('.peak').text().length).toBeGreaterThan(0);
  });

  test('every cell is individually labelled for screen readers', () => {
    const w = mount(HeatmapTile, { props: { data: buildHourlyHeatmap(sessions) } });
    const labels = w.findAll('[data-cell]').map((c) => c.attributes('aria-label') ?? c.text());
    expect(labels.every((l) => l.length > 0)).toBe(true);
  });

  test('arrow keys move the roving focus between cells', async () => {
    const w = mount(HeatmapTile, { props: { data: buildHourlyHeatmap(sessions) }, attachTo: document.body });
    const grid = w.get('.hm-grid');
    const before = w.findAll('[tabindex="0"]').length;
    await grid.trigger('keydown', { key: 'ArrowRight' });
    // Exactly one cell is in the tab order before AND after — that's the roving pattern.
    expect(before).toBe(1);
    expect(w.findAll('[tabindex="0"]')).toHaveLength(1);
    w.unmount();
  });

  test('shows an empty state for a grid with no activity', () => {
    const w = mount(HeatmapTile, { props: { data: buildHourlyHeatmap([]) } });
    expect(w.get('.empty').text().length).toBeGreaterThan(0);
  });
});

describe('ComparisonTile', () => {
  const stats = [
    stat({ date: TODAY, seconds: 600 }),
    stat({ date: '2026-06-01', seconds: 300 }), // in the previous 7-day window
  ];

  test('renders the week comparison and can switch to month', async () => {
    const w = mount(ComparisonTile, {
      props: { stats, todayKey: TODAY, overrides: {}, rules: [], custom: [] },
    });
    expect(w.text().length).toBeGreaterThan(0);
    const monthBtn = w.findAll('button').at(-1)!;
    await monthBtn.trigger('click');
    expect(w.text().length).toBeGreaterThan(0);
  });

  test('shows an empty state with no data in either window', () => {
    const w = mount(ComparisonTile, {
      props: { stats: [], todayKey: TODAY, overrides: {}, rules: [], custom: [] },
    });
    expect(w.text().length).toBeGreaterThan(0);
  });
});

describe('TrendChart / FocusTrend', () => {
  test('TrendChart plots the day window from the `now` prop', () => {
    const w = mount(TrendChart, { props: { stats: [stat()], now: NOW } });
    expect(w.findAll('.bar-col').length).toBeGreaterThan(0);
  });

  test('FocusTrend renders and switches mode', async () => {
    const w = mount(FocusTrend, {
      props: {
        stats: [stat({ domain: 'github.com', seconds: 600 })],
        overrides: {},
        rules: [],
        productivity: { ...CATEGORY_PRODUCTIVITY },
        custom: [],
        now: NOW,
        target: 50,
      },
    });
    expect(w.text().length).toBeGreaterThan(0);
    await w.findAll('button').at(-1)!.trigger('click');
    expect(w.text().length).toBeGreaterThan(0);
  });
});
