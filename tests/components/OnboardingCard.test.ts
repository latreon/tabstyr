import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import OnboardingCard from '@/components/OnboardingCard.vue';

// Stub Teleport so the dialog renders inline under the wrapper (it teleports to
// <body> in the app to support background `inert`).
const mountCard = () => mount(OnboardingCard, { attachTo: document.body, global: { stubs: { teleport: true } } });

describe('OnboardingCard', () => {
  test('renders a modal dialog starting on step 1 of 3, with no legend yet', () => {
    const w = mountCard();
    expect(w.get('[role="dialog"]').attributes('aria-modal')).toBe('true');
    expect(w.text()).toContain('Welcome to TabStyr');
    expect(w.text()).toContain("You're all set");
    expect(w.find('.back').exists()).toBe(false); // no Back button on the first step
    expect(w.get('.cta').text()).toBe('Next'); // not "Got it" yet
    expect(w.find('.legend').exists()).toBe(false); // legend only shows on the last step
    w.unmount();
  });

  test('"Next" advances through all 3 steps, then the CTA becomes "Got it" with the legend visible', async () => {
    const w = mountCard();
    await w.get('.cta').trigger('click'); // step 1 -> 2
    expect(w.text()).toContain('Just browse normally');
    expect(w.get('.back')).toBeTruthy();
    expect(w.get('.cta').text()).toBe('Next');
    expect(w.emitted('dismiss')).toBeUndefined();

    await w.get('.cta').trigger('click'); // step 2 -> 3
    expect(w.text()).toContain('Check back tomorrow');
    expect(w.get('.cta').text()).toBe('Got it');
    // 8 categories incl. Finance render in the legend, only on the final step
    expect(w.findAll('.legend li')).toHaveLength(8);
    expect(w.emitted('dismiss')).toBeUndefined();

    await w.get('.cta').trigger('click'); // final step's CTA dismisses
    expect(w.emitted('dismiss')).toHaveLength(1);
    w.unmount();
  });

  test('"Back" returns to the previous step without dismissing', async () => {
    const w = mountCard();
    await w.get('.cta').trigger('click'); // -> step 2
    await w.get('.back').trigger('click'); // -> step 1
    expect(w.text()).toContain("You're all set");
    expect(w.find('.back').exists()).toBe(false);
    expect(w.emitted('dismiss')).toBeUndefined();
    w.unmount();
  });

  test('Escape and backdrop click abandon the tour immediately from any step', async () => {
    const w1 = mountCard();
    await w1.get('.cta').trigger('click'); // now on step 2, mid-tour
    await w1.get('.backdrop').trigger('keydown', { key: 'Escape' });
    expect(w1.emitted('dismiss')).toHaveLength(1);
    w1.unmount();

    const w2 = mountCard();
    await w2.get('.backdrop').trigger('click'); // self-click on backdrop, still step 1
    expect(w2.emitted('dismiss')).toHaveLength(1);
    w2.unmount();
  });

  test('the close (✕) button dismisses immediately from any step', async () => {
    const w = mountCard();
    await w.get('.close').trigger('click');
    expect(w.emitted('dismiss')).toHaveLength(1);
    w.unmount();
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
