import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import TabTable from '@/components/TabTable.vue';
import type { TabRow } from '@/composables/useStats';

const ROWS: TabRow[] = [
  { tabId: 1, title: 'Alpha', domain: 'a.com', seconds: 100, lastActiveAt: 3000, tabCount: 1 },
  { tabId: 2, title: 'Beta', domain: 'b.com', seconds: 300, lastActiveAt: 1000, tabCount: 1 },
  { tabId: 3, title: 'Gamma', domain: 'c.com', seconds: 200, lastActiveAt: 2000, tabCount: 1 },
];

// The table now shows one row per DOMAIN — the visible label is the site.
const trackedOrder = (w: ReturnType<typeof mount>) =>
  w.findAll('tbody tr').map((r) => r.get('.title-text').text());

describe('TabTable', () => {
  test('defaults to sorting by tracked time, descending', () => {
    const w = mount(TabTable, { props: { rows: ROWS } });
    expect(trackedOrder(w)).toEqual(['b.com', 'c.com', 'a.com']); // 300,200,100
    const trackedTh = w.findAll('th')[1];
    expect(trackedTh.attributes('aria-sort')).toBe('descending');
  });

  test('clicking the Tracked header toggles to ascending', async () => {
    const w = mount(TabTable, { props: { rows: ROWS } });
    await w.findAll('th')[1].get('button').trigger('click');
    expect(trackedOrder(w)).toEqual(['a.com', 'c.com', 'b.com']); // 100,200,300
    expect(w.findAll('th')[1].attributes('aria-sort')).toBe('ascending');
  });

  test('switching to Last active sorts by recency and updates aria-sort', async () => {
    const w = mount(TabTable, { props: { rows: ROWS } });
    await w.findAll('th')[2].get('button').trigger('click');
    expect(trackedOrder(w)).toEqual(['a.com', 'c.com', 'b.com']); // lastActive 3000,2000,1000
    expect(w.findAll('th')[2].attributes('aria-sort')).toBe('descending');
    expect(w.findAll('th')[1].attributes('aria-sort')).toBe('none');
  });

  test('sort headers are real buttons (keyboard-activatable)', () => {
    const w = mount(TabTable, { props: { rows: ROWS } });
    expect(w.findAll('th')[1].get('button').element.tagName).toBe('BUTTON');
  });
});
