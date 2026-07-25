import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import FocusCategoriesTile from '@/components/FocusCategoriesTile.vue';
import { CATEGORIES, CATEGORY_PRODUCTIVITY, type CustomCategory } from '@/lib/categories';

// This tile is the only place a daily category budget can be SET. Budgets were
// readable (the category chart drew "over budget" pills) and the background nudged
// on them, but no control ever wrote one — the feature was unreachable.

const CUSTOM: CustomCategory[] = [{ name: 'Learning', color: '#123abc', productivity: 'productive' }];

function makeWrapper(budgets: Record<string, number> = {}) {
  return mount(FocusCategoriesTile, {
    props: { productivity: { ...CATEGORY_PRODUCTIVITY }, custom: CUSTOM, budgets },
  });
}

/** The budget stepper input for the nth row (built-ins first, then customs). */
const budgetInput = (w: ReturnType<typeof makeWrapper>, row: number) =>
  w.findAll('.prod-row')[row].get('.budget input');

describe('FocusCategoriesTile', () => {
  test('lists every built-in and custom category', () => {
    const w = makeWrapper();
    expect(w.findAll('.prod-row')).toHaveLength(CATEGORIES.length + CUSTOM.length);
  });

  test('shows a stored budget and marks an unset one as off', () => {
    const w = makeWrapper({ Social: 45 });
    const social = CATEGORIES.indexOf('Social');
    expect((budgetInput(w, social).element as HTMLInputElement).value).toBe('45');
    expect(w.findAll('.prod-row')[social].get('.budget-unit').text()).toBe('m');
    // Work has no budget → shown as off.
    expect(w.findAll('.prod-row')[CATEGORIES.indexOf('Work')].get('.budget-unit').text()).toBe('off');
  });

  test('setting a budget emits setBudget with the category and minutes', async () => {
    const w = makeWrapper();
    const social = CATEGORIES.indexOf('Social');
    const input = budgetInput(w, social);
    (input.element as HTMLInputElement).value = '30';
    await input.trigger('change');
    expect(w.emitted('setBudget')?.at(-1)).toEqual(['Social', 30]);
  });

  test('stepping a budget down to zero clears it (null, not 0)', async () => {
    const w = makeWrapper({ Social: 15 });
    const social = CATEGORIES.indexOf('Social');
    // step is 15 and min is 0, so one press of − lands exactly on zero.
    await w.findAll('.prod-row')[social].findAll('.budget button')[0].trigger('click');
    expect(w.emitted('setBudget')?.at(-1)).toEqual(['Social', null]);
  });

  test('a custom category gets its own budget control', async () => {
    const w = makeWrapper();
    const row = CATEGORIES.length; // first custom row
    const input = budgetInput(w, row);
    (input.element as HTMLInputElement).value = '60';
    await input.trigger('change');
    expect(w.emitted('setBudget')?.at(-1)).toEqual(['Learning', 60]);
  });

  test('the productivity pickers still emit set / setCustom', async () => {
    const w = makeWrapper();
    const rows = w.findAll('.prod-row');
    await rows[0].get('.trigger').trigger('click');
    await rows[0].findAll('[role="option"]')[1].trigger('click');
    expect(w.emitted('set')?.at(-1)?.[0]).toBe(CATEGORIES[0]);

    await rows[CATEGORIES.length].get('.trigger').trigger('click');
    await rows[CATEGORIES.length].findAll('[role="option"]')[1].trigger('click');
    expect(w.emitted('setCustom')?.at(-1)?.[0]).toBe('Learning');
  });

  test('every control carries an accessible name', () => {
    const w = makeWrapper();
    for (const input of w.findAll('.budget input')) {
      expect(input.attributes('aria-label')).toBeTruthy();
    }
    expect(w.get('.prod-list').attributes('aria-label')).toBeTruthy();
  });
});
