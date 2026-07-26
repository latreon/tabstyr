import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import NumberStepper from '@/components/ui/NumberStepper.vue';

// Set the raw field value and fire a specific DOM event, bypassing vue-test-utils'
// setValue (which triggers `input` and would obscure the input-vs-change contract).
function type(input: ReturnType<ReturnType<typeof mount>['get']>, value: string) {
  (input.element as HTMLInputElement).value = value;
}

describe('NumberStepper', () => {
  test('typing (input) does not emit or clamp — only change commits', async () => {
    const w = mount(NumberStepper, { props: { modelValue: 15, min: 15, max: 600, step: 5, label: 'Idle' } });
    const input = w.get('input');
    // Per-keystroke input must NOT emit; otherwise "180" clamps "1"→15 on the first
    // digit and the user can never reach a valid multi-digit value.
    type(input, '1');
    await input.trigger('input');
    type(input, '18');
    await input.trigger('input');
    type(input, '180');
    await input.trigger('input');
    expect(w.emitted('update:modelValue')).toBeUndefined();
    // Commit (blur / Enter fires `change`) → parse, clamp, emit.
    await input.trigger('change');
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([180]);
  });

  test('clamps an out-of-range value on commit', async () => {
    const w = mount(NumberStepper, { props: { modelValue: 15, min: 15, max: 600 } });
    const input = w.get('input');
    type(input, '9999');
    await input.trigger('change');
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([600]);
  });

  test('an empty entry reverts to the current value on commit (no snap to min)', async () => {
    const w = mount(NumberStepper, { props: { modelValue: 120, min: 15, max: 600 } });
    const input = w.get('input');
    type(input, '');
    await input.trigger('change');
    expect(w.emitted('update:modelValue')).toBeUndefined();
    expect((input.element as HTMLInputElement).value).toBe('120');
  });
});

// The field only commits on change/blur, so stepping had to read what the input
// SHOWS. Reading `modelValue` instead silently discarded a value the user had typed
// but not yet committed the moment they reached for − or +.
describe('NumberStepper steps from the typed value', () => {
  test('+ continues from uncommitted text in the field', async () => {
    const w = mount(NumberStepper, { props: { modelValue: 10, min: 0, max: 100, step: 5 } });
    const input = w.get('input');
    (input.element as HTMLInputElement).value = '40'; // typed, no change event yet
    await w.findAll('button')[1].trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([45]);
  });

  test('− continues from uncommitted text in the field', async () => {
    const w = mount(NumberStepper, { props: { modelValue: 10, min: 0, max: 100, step: 5 } });
    (w.get('input').element as HTMLInputElement).value = '40';
    await w.findAll('button')[0].trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([35]);
  });

  test('falls back to modelValue when the field is empty or junk', async () => {
    const w = mount(NumberStepper, { props: { modelValue: 10, min: 0, max: 100, step: 5 } });
    (w.get('input').element as HTMLInputElement).value = '';
    await w.findAll('button')[1].trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([15]);
  });

  test('a typed value beyond the bounds is clamped before stepping', async () => {
    const w = mount(NumberStepper, { props: { modelValue: 10, min: 0, max: 60, step: 5 } });
    (w.get('input').element as HTMLInputElement).value = '999';
    await w.findAll('button')[0].trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([55]); // clamp(999)=60, then −5
  });

  test('stepping clears the stale text left in the field', async () => {
    // clamp(999) − 5 = 55 while modelValue stays 10, so the bound :value doesn't
    // re-render; the field has to be synced by hand or it still reads "999".
    const w = mount(NumberStepper, { props: { modelValue: 10, min: 0, max: 60, step: 5 } });
    const input = w.get('input');
    (input.element as HTMLInputElement).value = '999';
    await w.findAll('button')[0].trigger('click');
    expect((input.element as HTMLInputElement).value).toBe('55');
  });
});

// The ± buttons must reflect what the user SEES, not the last committed value —
// otherwise typing the maximum left "+" looking usable (and vice versa at the min).
describe('NumberStepper button state follows the visible value', () => {
  const dec = (w: ReturnType<typeof mount>) => w.findAll('button')[0].element as HTMLButtonElement;
  const inc = (w: ReturnType<typeof mount>) => w.findAll('button')[1].element as HTMLButtonElement;

  test('disables + once the typed value reaches max', async () => {
    const w = mount(NumberStepper, { props: { modelValue: 10, min: 0, max: 60, step: 5 } });
    const input = w.get('input');
    expect(inc(w).disabled).toBe(false);
    type(input, '60');
    await input.trigger('input');
    expect(inc(w).disabled).toBe(true);
    expect(dec(w).disabled).toBe(false);
  });

  test('disables − once the typed value reaches min', async () => {
    const w = mount(NumberStepper, { props: { modelValue: 60, min: 15, max: 600, step: 5 } });
    const input = w.get('input');
    expect(dec(w).disabled).toBe(false);
    type(input, '15');
    await input.trigger('input');
    expect(dec(w).disabled).toBe(true);
  });

  test('an out-of-range or junk entry falls back to the committed value', async () => {
    const w = mount(NumberStepper, { props: { modelValue: 30, min: 0, max: 60, step: 5 } });
    const input = w.get('input');
    type(input, '999'); // clamps to max → + is unusable
    await input.trigger('input');
    expect(inc(w).disabled).toBe(true);
    type(input, 'abc'); // unusable entry → judge by modelValue again
    await input.trigger('input');
    expect(inc(w).disabled).toBe(false);
  });

  test('committing resets the draft so the buttons follow modelValue again', async () => {
    const w = mount(NumberStepper, { props: { modelValue: 30, min: 0, max: 60, step: 5 } });
    const input = w.get('input');
    type(input, '60');
    await input.trigger('input');
    expect(inc(w).disabled).toBe(true);
    await input.trigger('change'); // commits 60; parent keeps modelValue at 30 here
    await w.setProps({ modelValue: 30 });
    expect(inc(w).disabled).toBe(false);
  });
});
