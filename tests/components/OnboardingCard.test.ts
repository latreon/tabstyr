import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import OnboardingCard from '@/components/OnboardingCard.vue';

const mountCard = () => mount(OnboardingCard, { attachTo: document.body });

describe('OnboardingCard', () => {
  test('renders a modal dialog with title and category legend', () => {
    const w = mountCard();
    expect(w.get('[role="dialog"]').attributes('aria-modal')).toBe('true');
    expect(w.text()).toContain('Welcome to TabStyr');
    // 8 categories incl. Finance render in the legend
    expect(w.findAll('.legend li')).toHaveLength(8);
    w.unmount();
  });

  test('"Got it", Escape, and backdrop click each emit dismiss', async () => {
    const w1 = mountCard();
    await w1.get('.cta').trigger('click');
    expect(w1.emitted('dismiss')).toHaveLength(1);
    w1.unmount();

    const w2 = mountCard();
    await w2.get('.backdrop').trigger('keydown', { key: 'Escape' });
    expect(w2.emitted('dismiss')).toHaveLength(1);
    w2.unmount();

    const w3 = mountCard();
    await w3.get('.backdrop').trigger('click'); // self-click on backdrop
    expect(w3.emitted('dismiss')).toHaveLength(1);
    w3.unmount();
  });

  test('clicking inside the panel does not dismiss', async () => {
    const w = mountCard();
    await w.get('.modal').trigger('click');
    expect(w.emitted('dismiss')).toBeUndefined();
    w.unmount();
  });

  test('focus trap wraps Tab from last focusable back to first', async () => {
    const w = mountCard();
    const panel = w.get('.modal').element as HTMLElement;
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])'),
    );
    expect(focusables.length).toBeGreaterThan(1);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    expect(document.activeElement).toBe(last);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);

    // Shift+Tab from the first wraps to the last.
    first.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);
    w.unmount();
  });
});
