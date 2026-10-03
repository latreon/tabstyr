import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import CategoryPicker from '@/components/CategoryPicker.vue';
import { CATEGORIES } from '@/lib/categories';

// Reclassifying a site is the main way a user corrects the app's judgement, and this
// menu is how they do it. role="menu" promises arrow-key navigation, so that promise
// is what these tests hold it to.

const CUSTOM = [{ name: 'Learning', color: '#22c55e', productivity: 'productive' as const }];

function openMenu(w: ReturnType<typeof mount>) {
  return w.get('.trigger').trigger('click');
}

describe('CategoryPicker', () => {
  test('the trigger declares the popup it owns and names the current category', () => {
    const w = mount(CategoryPicker, { props: { current: 'Social' } });
    const trigger = w.get('.trigger');
    expect(trigger.attributes('aria-haspopup')).toBe('menu');
    expect(trigger.attributes('aria-expanded')).toBe('false');
    expect(trigger.attributes('aria-label')).toContain('Social');
  });

  test('opening reveals a menu of every built-in category', async () => {
    const w = mount(CategoryPicker, { props: { current: 'Social' } });
    await openMenu(w);
    expect(w.get('.trigger').attributes('aria-expanded')).toBe('true');
    const menu = w.get('[role="menu"]');
    const items = menu.findAll('[role="menuitemradio"]');
    expect(items).toHaveLength(CATEGORIES.length);
  });

  test('custom categories are offered alongside the built-ins', async () => {
    const w = mount(CategoryPicker, { props: { current: 'Other', custom: CUSTOM } });
    await openMenu(w);
    const labels = w.findAll('[role="menuitemradio"]').map((i) => i.text());
    expect(labels).toHaveLength(CATEGORIES.length + 1);
    expect(labels.some((l) => l.includes('Learning'))).toBe(true);
  });

  test('the current category is marked checked for screen readers', async () => {
    const w = mount(CategoryPicker, { props: { current: 'Media' } });
    await openMenu(w);
    const checked = w.findAll('[role="menuitemradio"]').filter((i) => i.attributes('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0].text()).toContain('Media');
  });

  test('choosing a different category emits it and closes the menu', async () => {
    const w = mount(CategoryPicker, { props: { current: 'Other' } });
    await openMenu(w);
    const dev = w.findAll('[role="menuitemradio"]').find((i) => i.text().includes('Dev'))!;
    await dev.trigger('click');
    expect(w.emitted('select')).toEqual([['Dev']]);
    expect(w.find('[role="menu"]').exists()).toBe(false);
  });

  test('re-choosing the current category emits nothing (no pointless write)', async () => {
    const w = mount(CategoryPicker, { props: { current: 'Dev' } });
    await openMenu(w);
    const dev = w.findAll('[role="menuitemradio"]').find((i) => i.text().includes('Dev'))!;
    await dev.trigger('click');
    expect(w.emitted('select')).toBeUndefined();
    expect(w.find('[role="menu"]').exists()).toBe(false);
  });

  test('arrow keys, Home and End move focus across the items', async () => {
    const app = document.createElement('div');
    document.body.appendChild(app);
    const w = mount(CategoryPicker, { props: { current: 'Work' }, attachTo: app });
    await openMenu(w);
    const menu = w.get('[role="menu"]');
    const items = menu.findAll('[role="menuitemradio"]').map((i) => i.element as HTMLButtonElement);

    items[0].focus();
    await menu.trigger('keydown', { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    await menu.trigger('keydown', { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[0]);
    await menu.trigger('keydown', { key: 'End' });
    expect(document.activeElement).toBe(items[items.length - 1]);
    await menu.trigger('keydown', { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
    // Wraps rather than dead-ending at the edges.
    await menu.trigger('keydown', { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[items.length - 1]);
    w.unmount();
    app.remove();
  });

  test('Escape closes the menu and restores trigger focus', async () => {
    const app = document.createElement('div');
    document.body.appendChild(app);
    const w = mount(CategoryPicker, { props: { current: 'Work' }, attachTo: app });
    await openMenu(w);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await w.vm.$nextTick();
    expect(w.find('[role="menu"]').exists()).toBe(false);
    expect(document.activeElement).toBe(w.get('.trigger').element);
    w.unmount();
    app.remove();
  });

  test('a click elsewhere on the page closes the menu', async () => {
    const w = mount(CategoryPicker, { props: { current: 'Work' }, attachTo: document.body });
    await openMenu(w);
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await w.vm.$nextTick();
    expect(w.find('[role="menu"]').exists()).toBe(false);
    w.unmount();
  });
});
