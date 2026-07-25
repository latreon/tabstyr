import { afterEach, describe, expect, test } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import TabsModal from '@/components/TabsModal.vue';
import type { TabListItem } from '@/composables/useStats';

const NOW = new Date(2026, 5, 11, 12, 0).getTime();
const HOUR = 3_600_000;
const DAY = 86_400_000;

// Deliberately: alphabetical order and staleness order disagree, so a test can tell
// which one the component used.
const ITEMS: TabListItem[] = [
  { tabId: 1, url: 'https://a.com/', title: 'Zebra docs', domain: 'a.com', lastActiveAt: NOW - 9 * DAY },
  { tabId: 2, url: 'https://b.com/', title: 'Apple notes', domain: 'b.com', lastActiveAt: NOW - 4 * DAY },
  { tabId: 3, url: 'https://c.com/', title: 'Mango board', domain: 'c.com', lastActiveAt: NOW - 6 * DAY },
];
/** Stale order as useStats hands it over: oldest first. */
const STALE = [...ITEMS].sort((a, b) => a.lastActiveAt - b.lastActiveAt);

// The modal teleports to <body>, so assertions read the document rather than the
// wrapper's own (empty) subtree.
let wrapper: VueWrapper | null = null;
function makeWrapper(mode: 'open' | 'stale', items = ITEMS) {
  wrapper = mount(TabsModal, { props: { mode, items, staleDays: 3, now: NOW } });
  return wrapper;
}
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = '';
});

const texts = (selector: string) =>
  [...document.querySelectorAll(selector)].map((n) => (n.textContent ?? '').trim());
const el = <T extends Element>(selector: string): T => {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`missing ${selector}`);
  return node;
};
const click = (node: Element) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }));

describe('TabsModal ordering', () => {
  test('stale mode keeps the incoming oldest-first ranking', () => {
    // It used to re-sort alphabetically, throwing away the "most worth closing
    // first" order that useStats.staleTabItems deliberately produces.
    makeWrapper('stale', STALE);
    expect(texts('.row-title')).toEqual(['Zebra docs', 'Mango board', 'Apple notes']);
  });

  test('open mode sorts alphabetically by title (no staleness ranking to keep)', () => {
    makeWrapper('open');
    expect(texts('.row-title')).toEqual(['Apple notes', 'Mango board', 'Zebra docs']);
  });
});

describe('TabsModal rendering and events', () => {
  test('is a labelled modal dialog', () => {
    makeWrapper('stale', STALE);
    const panel = el('[role="dialog"]');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.getAttribute('aria-label')).toBeTruthy();
  });

  test('renders a distinct relative last-active label per row', () => {
    makeWrapper('open', [
      { ...ITEMS[0], title: 'Recent', lastActiveAt: NOW - 5 * 60_000 },
      { ...ITEMS[1], title: 'Older', lastActiveAt: NOW - 3 * HOUR },
      { ...ITEMS[2], title: 'Never', lastActiveAt: 0 },
    ]);
    const times = texts('.row-time');
    expect(times.every((t) => t.length > 0)).toBe(true);
    expect(new Set(times).size).toBe(3); // three distinct buckets, not one fallback
  });

  test('row click emits goto, ✕ emits closeTab, close-all emits closeAll', async () => {
    const w = makeWrapper('stale', STALE);
    click(el('.row-main'));
    expect(w.emitted('goto')?.[0]).toEqual([STALE[0].tabId]);

    click(el('.row-close'));
    expect(w.emitted('closeTab')?.[0]?.[0]).toEqual(STALE[0]);

    click(el('.close-all'));
    expect(w.emitted('closeAll')?.[0]?.[0]).toHaveLength(3);
  });

  test('Escape emits close', () => {
    const w = makeWrapper('stale', STALE);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(w.emitted('close')).toBeTruthy();
  });

  test('shows an empty state instead of a list when there is nothing to show', () => {
    makeWrapper('stale', []);
    expect(document.querySelector('.list')).toBeNull();
    expect(el('.empty').textContent?.length).toBeGreaterThan(0);
  });

  test('the bulk action is hidden for a single tab', () => {
    makeWrapper('open', [ITEMS[0]]);
    expect(document.querySelector('.close-all')).toBeNull();
  });

  test('the page scroll is locked while open and released on close', () => {
    const w = makeWrapper('stale', STALE);
    expect(document.body.style.overflow).toBe('hidden');
    w.unmount();
    wrapper = null;
    expect(document.body.style.overflow).toBe('');
  });
});
