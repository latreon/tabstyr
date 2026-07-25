import { afterEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SelectBox from '@/components/ui/SelectBox.vue';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

function makeWrapper(modelValue = 'a') {
  return mount(SelectBox, { props: { modelValue, options: OPTIONS, label: 'Pick' } });
}

describe('SelectBox', () => {
  test('shows the selected option label and is closed initially', () => {
    const w = makeWrapper('b');
    expect(w.get('.trigger').text()).toContain('Beta');
    expect(w.find('.menu').exists()).toBe(false);
    expect(w.get('.trigger').attributes('aria-expanded')).toBe('false');
  });

  test('opens on click and lists options as listbox items', async () => {
    const w = makeWrapper();
    await w.get('.trigger').trigger('click');
    expect(w.get('.trigger').attributes('aria-expanded')).toBe('true');
    const items = w.findAll('[role="option"]');
    expect(items).toHaveLength(3);
    expect(items[0].attributes('aria-selected')).toBe('true'); // 'a' selected
  });

  test('selecting an option emits update:modelValue and closes', async () => {
    const w = makeWrapper();
    await w.get('.trigger').trigger('click');
    await w.findAll('[role="option"]')[2].trigger('click');
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['c']);
    expect(w.find('.menu').exists()).toBe(false);
  });

  test('keyboard: ArrowDown opens, moves active option, Enter selects', async () => {
    const w = makeWrapper('a');
    const trigger = w.get('.trigger');
    await trigger.trigger('keydown', { key: 'ArrowDown' }); // opens, active = current (a, idx 0)
    expect(w.find('.menu').exists()).toBe(true);
    await trigger.trigger('keydown', { key: 'ArrowDown' }); // active -> idx 1
    await trigger.trigger('keydown', { key: 'Enter' }); // select idx 1 = 'b'
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['b']);
  });

  test('Escape closes without selecting', async () => {
    const w = makeWrapper();
    await w.get('.trigger').trigger('keydown', { key: 'ArrowDown' });
    await w.get('.trigger').trigger('keydown', { key: 'Escape' });
    expect(w.find('.menu').exists()).toBe(false);
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });

  describe('placement', () => {
    const originalRect = Element.prototype.getBoundingClientRect;

    afterEach(() => {
      Element.prototype.getBoundingClientRect = originalRect;
      vi.unstubAllGlobals();
    });

    function stubRects(triggerRect: Partial<DOMRect>, menuRect: Partial<DOMRect>) {
      Element.prototype.getBoundingClientRect = function (this: Element) {
        if (this.classList.contains('selectbox')) return triggerRect as DOMRect;
        if (this.classList.contains('menu')) return menuRect as DOMRect;
        return originalRect.call(this);
      };
    }

    test('flips above the trigger when there is no room below', async () => {
      vi.stubGlobal('innerHeight', 400);
      stubRects({ top: 350, bottom: 380 }, { height: 150 });
      const w = makeWrapper();
      await w.get('.trigger').trigger('click');
      await nextTick();
      await nextTick();
      expect(w.get('.menu').classes()).toContain('open-up');
    });

    test('stays below the trigger when there is enough room', async () => {
      vi.stubGlobal('innerHeight', 900);
      stubRects({ top: 100, bottom: 130 }, { height: 150 });
      const w = makeWrapper();
      await w.get('.trigger').trigger('click');
      await nextTick();
      await nextTick();
      expect(w.get('.menu').classes()).not.toContain('open-up');
    });
  });
});

// The listbox is a SIBLING of the trigger, so aria-activedescendant alone pointed
// outside the trigger's subtree and screen readers announced nothing while arrowing.
// aria-owns is what re-parents it; both it and aria-controls must only reference the
// list while the list actually exists.
describe('SelectBox active-option wiring', () => {
  test('closed: no dangling aria references', () => {
    const trigger = makeWrapper().get('.trigger');
    expect(trigger.attributes('aria-owns')).toBeUndefined();
    expect(trigger.attributes('aria-controls')).toBeUndefined();
    expect(trigger.attributes('aria-activedescendant')).toBeUndefined();
  });

  test('open: aria-owns adopts the listbox and activedescendant names a real option', async () => {
    const w = makeWrapper('a');
    await w.get('.trigger').trigger('click');
    const trigger = w.get('.trigger');
    const listId = w.get('[role="listbox"]').attributes('id');
    expect(trigger.attributes('aria-owns')).toBe(listId);
    expect(trigger.attributes('aria-controls')).toBe(listId);
    const activeId = trigger.attributes('aria-activedescendant');
    expect(w.find(`#${activeId}`).exists()).toBe(true);
    expect(w.get(`#${activeId}`).attributes('role')).toBe('option');
  });

  test('activedescendant follows arrow keys', async () => {
    const w = makeWrapper('a');
    const trigger = w.get('.trigger');
    await trigger.trigger('keydown', { key: 'ArrowDown' }); // open, active = idx 0
    const first = trigger.attributes('aria-activedescendant');
    await trigger.trigger('keydown', { key: 'ArrowDown' }); // active = idx 1
    expect(trigger.attributes('aria-activedescendant')).not.toBe(first);
    expect(w.get(`#${trigger.attributes('aria-activedescendant')}`).text()).toContain('Beta');
  });
});
