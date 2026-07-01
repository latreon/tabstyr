import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import WrappedTile from '@/components/WrappedTile.vue';

describe('WrappedTile', () => {
  test('renders the Wrapped call-to-action', () => {
    const w = mount(WrappedTile);
    expect(w.text()).toContain('Browsing Wrapped');
    expect(w.text()).toContain('Open Wrapped');
    w.unmount();
  });

  test('clicking emits "open" so the dashboard can show the in-app Wrapped', async () => {
    const w = mount(WrappedTile);
    await w.get('button.wrapped-tile').trigger('click');
    expect(w.emitted('open')).toHaveLength(1);
    w.unmount();
  });
});
