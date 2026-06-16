import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import DatePicker from '@/components/ui/DatePicker.vue';

function makeWrapper(modelValue = '2026-06-16', min = '2026-01-01', max = '2026-06-16') {
  return mount(DatePicker, { props: { modelValue, min, max }, attachTo: document.body });
}

describe('DatePicker', () => {
  test('trigger shows the formatted date and opens the calendar', async () => {
    const w = makeWrapper();
    expect(w.get('.trigger').text()).toContain('Jun 16');
    expect(w.find('.cal').exists()).toBe(false);
    await w.get('.trigger').trigger('click');
    expect(w.find('[role="grid"]').exists()).toBe(true);
  });

  test('the selected day carries roving focus (tabindex 0)', async () => {
    const w = makeWrapper();
    await w.get('.trigger').trigger('click');
    const roving = w.findAll('.day').filter((d) => d.attributes('tabindex') === '0');
    expect(roving).toHaveLength(1);
    expect(roving[0].attributes('data-key')).toBe('2026-06-16');
  });

  test('arrow keys move the roving focus by day', async () => {
    const w = makeWrapper();
    await w.get('.trigger').trigger('click');
    await w.get('[role="grid"]').trigger('keydown', { key: 'ArrowLeft' });
    const roving = w.findAll('.day').find((d) => d.attributes('tabindex') === '0');
    expect(roving?.attributes('data-key')).toBe('2026-06-15');
  });

  test('arrow nav is clamped to max (cannot move past it)', async () => {
    const w = makeWrapper();
    await w.get('.trigger').trigger('click');
    await w.get('[role="grid"]').trigger('keydown', { key: 'ArrowRight' }); // 16th is max
    const roving = w.findAll('.day').find((d) => d.attributes('tabindex') === '0');
    expect(roving?.attributes('data-key')).toBe('2026-06-16');
  });

  test('days after max are disabled', async () => {
    const w = makeWrapper('2026-06-10', '2026-01-01', '2026-06-16');
    await w.get('.trigger').trigger('click');
    const d20 = w.findAll('.day').find((d) => d.attributes('data-key') === '2026-06-20');
    expect(d20?.attributes('disabled')).toBeDefined();
  });

  test('clicking a day emits update:modelValue and closes', async () => {
    const w = makeWrapper();
    await w.get('.trigger').trigger('click');
    const d10 = w.findAll('.day').find((d) => d.attributes('data-key') === '2026-06-10')!;
    await d10.trigger('click');
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['2026-06-10']);
    expect(w.find('.cal').exists()).toBe(false);
  });

  test('Escape closes the calendar', async () => {
    const w = makeWrapper();
    await w.get('.trigger').trigger('click');
    await w.get('.trigger').trigger('keydown', { key: 'Escape' });
    expect(w.find('.cal').exists()).toBe(false);
  });
});
