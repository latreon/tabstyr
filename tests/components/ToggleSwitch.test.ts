import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue';

// Every boolean preference in Settings is this control, so its ARIA contract is the
// only thing telling a screen-reader user what state they're in.

describe('ToggleSwitch', () => {
  test('exposes the switch role and its checked state', () => {
    const w = mount(ToggleSwitch, { props: { modelValue: false, label: 'Count audio' } });
    const btn = w.get('button');
    expect(btn.attributes('role')).toBe('switch');
    expect(btn.attributes('aria-checked')).toBe('false');
    expect(btn.attributes('aria-label')).toBe('Count audio');
    expect(btn.attributes('type')).toBe('button'); // never submits a surrounding form
  });

  test('aria-checked follows the model', async () => {
    const w = mount(ToggleSwitch, { props: { modelValue: false } });
    await w.setProps({ modelValue: true });
    expect(w.get('button').attributes('aria-checked')).toBe('true');
  });

  test('clicking emits the inverted value (parent owns the state)', async () => {
    const w = mount(ToggleSwitch, { props: { modelValue: false } });
    await w.get('button').trigger('click');
    expect(w.emitted('update:modelValue')).toEqual([[true]]);
    // The component must NOT flip itself — a rejected save has to be able to win.
    expect(w.get('button').attributes('aria-checked')).toBe('false');
  });

  test('clicking an on switch turns it off', async () => {
    const w = mount(ToggleSwitch, { props: { modelValue: true } });
    await w.get('button').trigger('click');
    expect(w.emitted('update:modelValue')).toEqual([[false]]);
  });

  test('the knob is hidden from assistive tech (the button carries the meaning)', () => {
    const w = mount(ToggleSwitch, { props: { modelValue: true } });
    expect(w.get('.knob').attributes('aria-hidden')).toBe('true');
  });
});
