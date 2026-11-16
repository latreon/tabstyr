import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { resetDBConnection } from '@/lib/db/db';
import * as repo from '@/lib/db/repo';
import { DEFAULT_SETTINGS, getSettings, invalidateSettings, saveSettings } from '@/lib/settings';
import { i18n } from '@/lib/i18n';
import { toJsonBackup } from '@/lib/export';
import { MAX_BACKUP_BYTES, parseBackup } from '@/lib/restore';
import { MIN_PASSPHRASE, decryptFromEnvelope, encryptToEnvelope } from '@/lib/crypto';
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

afterEach(() => {
  vi.restoreAllMocks();
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
      await wrapper.findAllComponents({ name: 'NumberStepper' })[0]!.findAll('button')[1]!.trigger('click');
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

describe('SettingsPanel controls', () => {
  // Each test starts from empty extension storage.
  beforeEach(() => {
    fakeBrowser.reset();
    invalidateSettings();
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined);
  });

  const tr = (key: string, params: Record<string, unknown> = {}) => i18n.global.t(key, params);

  async function mountPanel() {
    wrapper = mount(SettingsPanel);
    await flush();
    await new Promise((r) => setTimeout(r, 0)); // let onMounted's settings read finish
    await flush();
    return wrapper;
  }
  const toast = () => wrapper!.find('.toast').text();
  const button = (label: string) => wrapper!.findAll('button').find((b) => b.text() === tr(label))!;
  const dialogButton = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === tr(label))!;
  const waitForSave = () => vi.waitFor(() => expect(wrapper!.find('.toast').exists()).toBe(true), { timeout: 2_000 });

  // Downloads as the browser sees them: the file name and the bytes.
  function captureDownloads() {
    const files: { name: string; text: () => Promise<string> }[] = [];
    let lastBlob: Blob;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      lastBlob = blob as Blob;
      return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      const blob = lastBlob;
      files.push({ name: this.download, text: () => blob.text() });
    });
    return files;
  }

  async function pickFile(inputIndex: 0 | 1, name: string, content: string) {
    const input = wrapper!.findAll('input[type="file"]')[inputIndex]!;
    Object.defineProperty(input.element, 'files', { value: [new File([content], name)], configurable: true });
    await input.trigger('change');
    await vi.waitFor(() => new Promise((r) => setTimeout(r, 10)));
    await flush();
  }

  test.each([
    ['pause tracking', 0, { trackingPaused: true }],
    ['count audio', 1, { audioEnabled: false }],
    ['notifications', 2, { notificationsEnabled: false }],
  ] as const)('the %s switch saves its setting', async (_name, index, expected) => {
    await mountPanel();
    await wrapper!.findAll('[role="switch"]')[index]!.trigger('click');
    await waitForSave();
    invalidateSettings();
    expect(await getSettings()).toMatchObject(expected);
  });

  test.each([
    ['idle timeout', 1, { idleSeconds: 195 }],
    ['session alert', 2, { sessionAlertMinutes: 35 }],
    ['focus target', 3, { focusTarget: 55 }],
  ] as const)('the %s stepper saves its setting', async (_name, index, expected) => {
    await mountPanel();
    await wrapper!.findAllComponents({ name: 'NumberStepper' })[index]!.findAll('button')[1]!.trigger('click');
    await waitForSave();
    invalidateSettings();
    expect(await getSettings()).toMatchObject(expected);
  });

  test('the scheduled backup picker saves the interval', async () => {
    await mountPanel();
    const picker = wrapper!.findAllComponents({ name: 'SelectBox' })[2]!;
    picker.vm.$emit('update:modelValue', '7');
    await waitForSave();
    invalidateSettings();
    expect((await getSettings()).autoExportDays).toBe(7);
  });

  test('a failed save shows the error toast', async () => {
    await mountPanel();
    vi.spyOn(browser.storage.local, 'set').mockRejectedValue(new Error('full'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await wrapper!.findAll('[role="switch"]')[0]!.trigger('click');
    await waitForSave();
    expect(toast()).toBe(tr('settings.saveFailed'));
  });

  test('"show intro again" clears the onboarded flag and refreshes the dashboard', async () => {
    await saveSettings({ onboarded: true });
    await mountPanel();
    await button('settings.showIntro').trigger('click');
    await waitForSave();
    expect((await getSettings()).onboarded).toBe(false);
    expect(wrapper!.emitted('changed')).toBeTruthy();
    expect(toast()).toBe(tr('settings.introShown'));
  });

  describe('backup export', () => {
    test('Export JSON downloads a restorable backup of the stored data', async () => {
      await repo.applyDailyStatsMax([{ date: '2026-06-16', domain: 'a.com', seconds: 60, audioSeconds: 0 }]);
      const files = captureDownloads();
      await mountPanel();

      await button('settings.exportJson').trigger('click');
      await waitForSave();

      expect(files[0]!.name).toMatch(/^tabstyr-backup-\d{4}-\d{2}-\d{2}\.json$/);
      expect(parseBackup(await files[0]!.text()).dailyStats).toHaveLength(1);
      expect(toast()).toBe(tr('settings.exportedJson'));
    });

    test('a failed export shows the error toast', async () => {
      vi.spyOn(repo, 'getAllSessions').mockRejectedValue(new Error('db down'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await mountPanel();
      await button('settings.exportJson').trigger('click');
      await waitForSave();
      expect(toast()).toBe(tr('settings.exportFailed'));
    });

    test('the encrypted export checks the passphrase, then downloads an envelope the same passphrase opens', async () => {
      const files = captureDownloads();
      await mountPanel();
      await button('settings.encrypted').trigger('click');
      const [pass, confirmPass] = wrapper!.findAll('.enc-form input[type="password"]');
      const submit = () => wrapper!.find('.enc-form').trigger('submit');

      await pass!.setValue('short');
      await confirmPass!.setValue('short');
      await submit();
      expect(wrapper!.find('.enc-form [role="alert"]').text()).toBe(tr('settings.passTooShort', { min: MIN_PASSPHRASE }));

      await pass!.setValue('correct horse battery');
      await confirmPass!.setValue('correct horse batterz');
      await submit();
      expect(wrapper!.find('.enc-form [role="alert"]').text()).toBe(tr('settings.passMismatch'));

      await confirmPass!.setValue('correct horse battery');
      await submit();
      await vi.waitFor(() => expect(files).toHaveLength(1), { timeout: 10_000 });

      expect(files[0]!.name).toMatch(/\.enc\.json$/);
      expect(parseBackup(await decryptFromEnvelope(await files[0]!.text(), 'correct horse battery'))).toBeTruthy();
      await flush();
      expect(wrapper!.find('.enc-form').exists()).toBe(false);
    }, 15_000);
  });

  describe('restore', () => {
    const backup = () =>
      toJsonBackup(
        { dailyStats: [{ date: '2026-06-16', domain: 'b.com', seconds: 60, audioSeconds: 0 }], monthlyStats: [], sessions: [], tabMeta: [], settings: DEFAULT_SETTINGS },
        Date.now(),
      );

    test('a file that is not a backup shows an error and opens no dialog', async () => {
      await mountPanel();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await pickFile(0, 'x.json', '{"hello":1}');
      expect(wrapper!.find('[role="alert"]').text()).toBe(tr('settings.restoreInvalid'));
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    test('a file over the size limit is refused before it is read', async () => {
      await mountPanel();
      const input = wrapper!.findAll('input[type="file"]')[0]!;
      const huge = new File(['{}'], 'big.json');
      Object.defineProperty(huge, 'size', { value: MAX_BACKUP_BYTES + 1 });
      const read = vi.spyOn(huge, 'text');
      Object.defineProperty(input.element, 'files', { value: [huge], configurable: true });
      await input.trigger('change');
      await flush();
      expect(wrapper!.find('[role="alert"]').text()).toBe(tr('settings.restoreTooLarge'));
      expect(read).not.toHaveBeenCalled();
    });

    test('replace saves the current data first, then restores the file', async () => {
      await repo.applyDailyStatsMax([{ date: '2026-06-01', domain: 'old.com', seconds: 60, audioSeconds: 0 }]);
      const files = captureDownloads();
      await mountPanel();
      await pickFile(0, 'backup.json', backup());

      dialogButton('settings.replaceData').click();
      await waitForSave();

      expect(files[0]!.name).toMatch(/^tabstyr-before-restore-/);
      expect(parseBackup(await files[0]!.text()).dailyStats[0]!.domain).toBe('old.com');
      expect((await repo.getAllDailyStats()).map((s) => s.domain)).toEqual(['b.com']);
      expect(wrapper!.emitted('changed')).toBeTruthy();
    });

    test('merge keeps the current data and adds the file', async () => {
      await repo.applyDailyStatsMax([{ date: '2026-06-01', domain: 'old.com', seconds: 60, audioSeconds: 0 }]);
      await mountPanel();
      await pickFile(0, 'backup.json', backup());

      dialogButton('settings.mergeData').click();
      await waitForSave();

      expect((await repo.getAllDailyStats()).map((s) => s.domain).sort()).toEqual(['b.com', 'old.com']);
    });

    test('an encrypted file asks for the passphrase and rejects a wrong one', async () => {
      await mountPanel();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await pickFile(0, 'backup.enc.json', await encryptToEnvelope(backup(), 'correct horse battery'));

      const form = wrapper!.find('.enc-form');
      await form.find('input[type="password"]').setValue('wrong passphrase!!');
      await form.trigger('submit');
      await vi.waitFor(() => expect(wrapper!.find('[role="alert"]').exists()).toBe(true), { timeout: 10_000 });
      expect(wrapper!.find('[role="alert"]').text()).toBe(tr('settings.restoreWrongPass'));

      await wrapper!.find('.enc-form input[type="password"]').setValue('correct horse battery');
      await wrapper!.find('.enc-form').trigger('submit');
      await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull(), { timeout: 10_000 });
    }, 20_000);
  });

  describe('CSV import', () => {
    test('a valid file adds estimated days and reports how many', async () => {
      await mountPanel();
      await pickFile(1, 'export.csv', 'Date,Activity,Time Spent (seconds)\n2026-06-01,github.com,600\n2026-06-02,github.com,300\n');
      await waitForSave();
      expect(await repo.getAllDailyStats()).toHaveLength(2);
      expect(toast()).toBe(tr('settings.imported', { count: 2 }));
    });

    test('a file with no usable rows says so and changes nothing', async () => {
      await mountPanel();
      await pickFile(1, 'export.csv', 'Date,Activity,Time Spent (seconds)\n2026-06-01,Microsoft Word,600\n');
      await waitForSave();
      expect(await repo.getAllDailyStats()).toEqual([]);
      expect(toast()).toBe(tr('settings.importEmpty'));
    });

    test('a file that is not a usable CSV shows the error toast', async () => {
      await mountPanel();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await pickFile(1, 'export.csv', 'just some text');
      await waitForSave();
      expect(toast()).toBe(tr('settings.importInvalid'));
    });
  });

  test('a failed wipe keeps the dialog open and shows the error toast', async () => {
    await mountPanel();
    vi.spyOn(browser.runtime, 'sendMessage').mockRejectedValue(new Error('worker gone'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await wrapper!.findAll('button').find((b) => b.classes('btn-danger'))!.trigger('click');
    await flush();
    dialogButton('settings.deleteEverything').click();
    await waitForSave();
    expect(toast()).toBe(tr('settings.wipeFailed'));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
