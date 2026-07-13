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
