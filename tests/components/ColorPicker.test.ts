import { afterEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ColorPicker from '@/components/ui/ColorPicker.vue';

function makeWrapper(modelValue = '#6366f1') {
  return mount(ColorPicker, { props: { modelValue, label: 'Category color' } });
}

describe('ColorPicker', () => {
  test('shows the current color and hex on the closed trigger', () => {
    const w = makeWrapper('#10b981');
    expect(w.get('.trigger-swatch').attributes('style')).toContain('background: #10b981');
    expect(w.get('.trigger-hex').text()).toBe('#10B981');
    expect(w.find('.panel').exists()).toBe(false);
  });

  test('opens the panel on trigger click', async () => {
    const w = makeWrapper();
    await w.get('.trigger').trigger('click');
    expect(w.find('.panel').exists()).toBe(true);
    expect(w.get('.trigger').attributes('aria-expanded')).toBe('true');
  });

  test('clicking a preset emits its hex and marks it pressed', async () => {
    const w = makeWrapper('#6366f1');
    await w.get('.trigger').trigger('click');
    const presets = w.findAll('.preset');
    await presets[2].trigger('click'); // '#10b981'
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['#10b981']);
  });

  test('typing a valid hex emits it normalized', async () => {
    const w = makeWrapper();
    await w.get('.trigger').trigger('click');
    const input = w.get('.hex-input');
    await input.setValue('#ABCDEF');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['#abcdef']);
    expect(w.find('.hex-input').classes()).not.toContain('invalid');
  });

  test('typing an invalid hex does not emit and flags invalid', async () => {
    const w = makeWrapper();
    await w.get('.trigger').trigger('click');
    const input = w.get('.hex-input');
    await input.setValue('#zz');
    expect(w.emitted('update:modelValue')).toBeUndefined();
    expect(w.get('.hex-input').classes()).toContain('invalid');
  });

  test('Escape closes the panel', async () => {
    const w = makeWrapper();
    await w.get('.trigger').trigger('click');
    expect(w.find('.panel').exists()).toBe(true);
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await w.vm.$nextTick();
    expect(w.find('.panel').exists()).toBe(false);
  });

  describe('placement', () => {
    const originalRect = Element.prototype.getBoundingClientRect;

    afterEach(() => {
      Element.prototype.getBoundingClientRect = originalRect;
      vi.unstubAllGlobals();
    });

    function stubRects(triggerRect: Partial<DOMRect>, panelRect: Partial<DOMRect>) {
      Element.prototype.getBoundingClientRect = function (this: Element) {
        if (this.classList.contains('color-picker')) return triggerRect as DOMRect;
        if (this.classList.contains('panel')) return panelRect as DOMRect;
        return originalRect.call(this);
      };
    }

    test('flips above the trigger when there is no room below', async () => {
      vi.stubGlobal('innerHeight', 400);
      // Trigger sits near the bottom of a short viewport; the panel (300px tall)
      // would run off-screen if it opened downward as usual.
      stubRects({ top: 350, bottom: 380 }, { height: 300 });
      const w = makeWrapper();
      await w.get('.trigger').trigger('click');
      await nextTick();
      await nextTick();
      expect(w.get('.panel').classes()).toContain('open-up');
    });

    test('stays below the trigger when there is enough room', async () => {
      vi.stubGlobal('innerHeight', 900);
      stubRects({ top: 100, bottom: 130 }, { height: 300 });
      const w = makeWrapper();
      await w.get('.trigger').trigger('click');
      await nextTick();
      await nextTick();
      expect(w.get('.panel').classes()).not.toContain('open-up');
    });
  });
});
