import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { fakeBrowser } from 'wxt/testing';
import CustomizationPanel from '@/components/CustomizationPanel.vue';
import { getSettings, invalidateSettings, saveSettings } from '@/lib/settings';

// The panel owns two pieces of persisted user configuration — custom categories and
// substring rules — and it is the largest previously-untested component. Its job is
// to validate before writing and to keep its own view in step with what the
// sanitizer actually stored.

let sendMessage: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fakeBrowser.reset();
  invalidateSettings();
  vi.restoreAllMocks();
  sendMessage = vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockResolvedValue(undefined);
});

async function panel(props: Record<string, unknown> = {}) {
  const w = mount(CustomizationPanel, { props });
  await vi.waitFor(() => expect(w.html()).toContain('input'));
  return w;
}

// The two text inputs are, in DOM order, the new-category name and the new-rule
// pattern; each is followed by its own submit button.
const catInput = (w: VueWrapper) => w.findAll('input[type="text"]')[0];
const ruleInput = (w: VueWrapper) => w.findAll('input[type="text"]')[1];

async function addCategory(w: VueWrapper, name: string) {
  await catInput(w).setValue(name);
  await w.findAll('form')[0].trigger('submit'); // the category composer submits on Enter
}

describe('CustomizationPanel: custom categories', () => {
  test('adding a category persists it and tells the other contexts', async () => {
    const w = await panel();
    await addCategory(w, 'Learning');
    await vi.waitFor(async () => {
      expect((await getSettings()).customCategories.map((c) => c.name)).toContain('Learning');
    });
    expect(sendMessage).toHaveBeenCalledWith({ type: 'settings-changed' });
    expect(w.emitted('changed')).toBeTruthy();
  });

  test('a new category starts neutral so it cannot silently move the focus score', async () => {
    const w = await panel();
    await addCategory(w, 'Learning');
    await vi.waitFor(async () => {
      const cat = (await getSettings()).customCategories.find((c) => c.name === 'Learning');
      expect(cat?.productivity).toBe('neutral');
    });
  });

  test('a name colliding with a built-in is refused with a visible error', async () => {
    const w = await panel();
    await addCategory(w, 'Work');
    await w.vm.$nextTick();
    expect(w.text()).not.toBe('');
    expect((await getSettings()).customCategories).toEqual([]);
    expect(w.find('.rule-error, .cat-error, [role="alert"]').exists()).toBe(true);
  });

  test('a duplicate custom name is refused case-insensitively', async () => {
    await saveSettings({ customCategories: [{ name: 'Learning', color: '#22c55e', productivity: 'neutral' }] });
    const w = await panel({ custom: [{ name: 'Learning', color: '#22c55e', productivity: 'neutral' }] });
    await addCategory(w, 'learning');
    await w.vm.$nextTick();
    expect((await getSettings()).customCategories).toHaveLength(1);
  });

  test('a blank name is a no-op, not an error', async () => {
    const w = await panel();
    await addCategory(w, '   ');
    expect((await getSettings()).customCategories).toEqual([]);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test('existing categories are listed, and removing one drops rules that referenced it', async () => {
    const custom = [{ name: 'Learning', color: '#22c55e', productivity: 'neutral' as const }];
    await saveSettings({ customCategories: custom, categoryRules: [{ pattern: 'udemy', category: 'Learning' }] });
    const w = await panel({ custom, categoryRules: [{ pattern: 'udemy', category: 'Learning' }] });
    expect(w.text()).toContain('Learning');

    // The remove control sits inside the category list item.
    const remove = w.findAll('.cat-list button').at(-1)!;
    await remove.trigger('click');
    await vi.waitFor(async () => {
      const s = await getSettings();
      expect(s.customCategories).toEqual([]);
      expect(s.categoryRules).toEqual([]); // the orphaned rule went with it
    });
    // The panel's own view reflects what the sanitizer stored, not what we sent.
    expect(w.text()).not.toContain('udemy');
  });
});

describe('CustomizationPanel: rules', () => {
  async function addRule(w: VueWrapper, pattern: string) {
    await ruleInput(w).setValue(pattern);
    await w.findAll('form').at(-1)!.trigger('submit');
  }

  test('adding a rule persists it lowercased and trimmed', async () => {
    const w = await panel();
    await addRule(w, '  MyCompany.COM  ');
    await vi.waitFor(async () => {
      expect((await getSettings()).categoryRules).toEqual([{ pattern: 'mycompany.com', category: 'Work' }]);
    });
    expect(sendMessage).toHaveBeenCalledWith({ type: 'settings-changed' });
  });

  test('a duplicate pattern is refused rather than stored twice', async () => {
    await saveSettings({ categoryRules: [{ pattern: 'mycompany.com', category: 'Work' }] });
    const w = await panel({ categoryRules: [{ pattern: 'mycompany.com', category: 'Work' }] });
    await addRule(w, 'mycompany.com');
    await w.vm.$nextTick();
    expect((await getSettings()).categoryRules).toHaveLength(1);
    expect(w.find('[role="alert"], .rule-error').exists()).toBe(true);
  });

  test('a blank pattern is a no-op', async () => {
    const w = await panel();
    await addRule(w, '  ');
    expect((await getSettings()).categoryRules).toEqual([]);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test('existing rules are listed and can be removed', async () => {
    const rules = [{ pattern: 'mycompany.com', category: 'Work' as const }];
    await saveSettings({ categoryRules: rules });
    const w = await panel({ categoryRules: rules });
    expect(w.text()).toContain('mycompany.com');

    await w.findAll('.rule-list button, .rules li button').at(-1)!.trigger('click');
    await vi.waitFor(async () => expect((await getSettings()).categoryRules).toEqual([]));
  });
});

describe('CustomizationPanel: staying in sync', () => {
  test('adopts a settings-changed broadcast from another surface (e.g. a restore)', async () => {
    const w = await panel();
    await saveSettings({ categoryRules: [{ pattern: 'restored.example', category: 'Dev' }] });
    invalidateSettings();
    await fakeBrowser.runtime.onMessage.trigger({ type: 'settings-changed' }, {});
    await vi.waitFor(() => expect(w.text()).toContain('restored.example'));
  });

  test('ignores unrelated runtime messages', async () => {
    const w = await panel();
    const before = w.text();
    await fakeBrowser.runtime.onMessage.trigger({ type: 'wipe-data' }, {});
    await w.vm.$nextTick();
    expect(w.text()).toBe(before);
  });

  test('mirrors prop updates from the parent without a round-trip', async () => {
    const w = await panel();
    await w.setProps({ categoryRules: [{ pattern: 'from-parent.example', category: 'Work' }] });
    expect(w.text()).toContain('from-parent.example');
  });
});
