import { afterEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ReviewPrompt from '@/components/ReviewPrompt.vue';
import { CHROME_STORE_REVIEW_URL } from '@/lib/links';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReviewPrompt', () => {
  test('renders the title, body, and both action buttons', () => {
    const w = mount(ReviewPrompt);
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    expect(w.get('.title').text().length).toBeGreaterThan(0);
    expect(w.get('.body').text().length).toBeGreaterThan(0);
    const actionLabels = w.findAll('.actions button').map((b) => b.text());
    expect(actionLabels).toHaveLength(2);
    w.unmount();
  });

  test('has no backdrop — it floats over the corner rather than gating the page', () => {
    const w = mount(ReviewPrompt);
    expect(w.find('.backdrop').exists()).toBe(false);
    w.unmount();
  });

  test('the close (✕) button emits dismiss without opening any URL', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const w = mount(ReviewPrompt);
    w.get('.close').trigger('click');
    expect(w.emitted('dismiss')).toHaveLength(1);
    expect(openSpy).not.toHaveBeenCalled();
    w.unmount();
  });

  test('the dismiss action emits dismiss without opening any URL', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const w = mount(ReviewPrompt);
    w.get('.actions .btn-ghost').trigger('click');
    expect(w.emitted('dismiss')).toHaveLength(1);
    expect(openSpy).not.toHaveBeenCalled();
    w.unmount();
  });

  test('the rate action opens the Chrome Web Store review page and then dismisses', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const w = mount(ReviewPrompt);
    w.get('.actions .btn-primary').trigger('click');
    expect(openSpy).toHaveBeenCalledWith(CHROME_STORE_REVIEW_URL, '_blank', 'noopener');
    expect(w.emitted('dismiss')).toHaveLength(1);
    w.unmount();
  });
});
