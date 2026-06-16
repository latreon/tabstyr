import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
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
});
