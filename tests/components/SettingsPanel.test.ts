import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { browser } from 'wxt/browser';
import { resetDBConnection } from '@/lib/db/db';
import { invalidateSettings, saveSettings } from '@/lib/settings';
import SettingsPanel from '@/components/SettingsPanel.vue';

// Regression cover for a bug that fired on EVERY dashboard open: the panel seeds its
// refs from stored settings in onMounted, and the auto-save watcher is pre-flush, so
// flipping the `loaded` gate synchronously right after the seeding let the watcher see
// it already open. The panel then wrote the settings straight back, broadcast
// settings-changed, reloaded the whole dashboard and flashed a "Saved" toast — for
// anyone whose settings differed from the defaults.

const flush = async () => {
  await nextTick();
  await nextTick();
  await nextTick();
};
/** The auto-save is debounced by 400ms; advance past it. */
const settleAutoSave = async () => {
  await vi.advanceTimersByTimeAsync(600);
  await flush();
};

let wrapper: VueWrapper | null = null;

beforeEach(() => {
  vi.useRealTimers();
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = '';
  globalThis.indexedDB = new IDBFactory();
  resetDBConnection();
  invalidateSettings();
  vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined);
});

describe('SettingsPanel does not save on mount', () => {
  test('non-default stored settings are seeded WITHOUT writing them back', async () => {
    vi.useFakeTimers();
    try {
      // The bug only showed with values that differ from the defaults — identical
      // values never trigger the watcher at all.
      await saveSettings({ staleDays: 9, idleSeconds: 300, focusTarget: 70 });
      const sendMessage = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined);

      wrapper = mount(SettingsPanel);
      await flush();
      await settleAutoSave();

      expect(sendMessage).not.toHaveBeenCalled();
      expect(wrapper.emitted('changed')).toBeUndefined();
      expect(wrapper.find('.toast').exists()).toBe(false);
      // …and the stored values are intact.
      const { getSettings } = await import('@/lib/settings');
      const s = await getSettings();
      expect([s.staleDays, s.idleSeconds, s.focusTarget]).toEqual([9, 300, 70]);
    } finally {
      vi.useRealTimers();
    }
  });

  test('a real user change DOES save, broadcast and confirm', async () => {
    vi.useFakeTimers();
    try {
      await saveSettings({ staleDays: 9 });
      const sendMessage = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined);
      wrapper = mount(SettingsPanel);
      await flush();
      await settleAutoSave();
      expect(sendMessage).not.toHaveBeenCalled(); // still quiet after mount

      // Bump the stale-days stepper (the first NumberStepper in the panel).
      await wrapper.findAllComponents({ name: 'NumberStepper' })[0].findAll('button')[1].trigger('click');
      await settleAutoSave();

      const types = sendMessage.mock.calls.map((a) => (a[0] as { type?: string })?.type);
      expect(types).toContain('settings-changed');
      expect(wrapper.emitted('changed')).toBeTruthy();
      const { getSettings } = await import('@/lib/settings');
      expect((await getSettings()).staleDays).toBe(10);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SettingsPanel destructive actions', () => {
  test('the wipe dialog must be confirmed before anything is sent', async () => {
    wrapper = mount(SettingsPanel);
    await flush();
    const sendMessage = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined);
    sendMessage.mockClear(); // only care about what the ACTION sends

    // Opening the dialog sends nothing.
    const wipeBtn = wrapper.findAll('button').find((b) => b.classes('btn-danger'))!;
    await wipeBtn.trigger('click');
    await flush();
    expect(sendMessage).not.toHaveBeenCalled();

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');

    // Confirming does.
    const confirm = [...document.querySelectorAll('button')].find((b) => b.classList.contains('btn-danger-solid'))!;
    confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(sendMessage.mock.calls.map((a) => (a[0] as { type?: string })?.type)).toContain('wipe-data');
  });

  test('Escape closes the wipe dialog without wiping', async () => {
    wrapper = mount(SettingsPanel);
    await flush();
    const sendMessage = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined);
    sendMessage.mockClear();
    await wrapper.findAll('button').find((b) => b.classes('btn-danger'))!.trigger('click');
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flush();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
