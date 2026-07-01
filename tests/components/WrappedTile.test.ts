import { describe, expect, test, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { fakeBrowser } from 'wxt/testing';
import WrappedTile from '@/components/WrappedTile.vue';
import { WRAPPED_URL } from '@/lib/links';

describe('WrappedTile', () => {
  beforeEach(() => fakeBrowser.reset());

  test('renders the Wrapped call-to-action', () => {
    const w = mount(WrappedTile);
    expect(w.text()).toContain('Browsing Wrapped');
    expect(w.text()).toContain('Open Wrapped');
    w.unmount();
  });

  test('clicking opens the web Wrapped page in a new tab (no in-page navigation)', async () => {
    const create = vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue({} as never);
    const w = mount(WrappedTile);
    await w.get('button.wrapped-tile').trigger('click');
    expect(create).toHaveBeenCalledWith({ url: WRAPPED_URL });
    expect(WRAPPED_URL).toBe('https://tabstyr.com/wrapped');
    w.unmount();
  });
});
