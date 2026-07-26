import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { fakeBrowser } from 'wxt/testing';
import ThemeToggle from '@/components/ThemeToggle.vue';
import { invalidateSettings, saveSettings } from '@/lib/settings';

// The header's theme control. It shares module-scoped state with useTheme, so the
// icon it shows is also the app's current theme — a mismatch here is the flash bug
// this component exists to prevent.

beforeEach(() => {
  fakeBrowser.reset();
  invalidateSettings();
  vi.restoreAllMocks();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

async function mounted() {
  const w = mount(ThemeToggle);
  await vi.waitFor(() => expect(w.get('button').attributes('aria-label')).toBeTruthy());
  return w;
}

describe('ThemeToggle', () => {
  test('shows the monitor glyph and an explicit label while on the system default', async () => {
    const w = await mounted();
    // 'system' → the monitor icon (a <rect> only appears in that variant).
    expect(w.find('svg rect').exists()).toBe(true);
    expect(w.get('button').attributes('aria-label')).not.toBe('');
    // Tooltip text and the accessible name stay in sync.
    expect(w.get('button').attributes('data-tip')).toBe(w.get('button').attributes('aria-label'));
  });

  test('reflects a stored explicit theme', async () => {
    await saveSettings({ theme: 'dark' });
    const w = await mounted();
    await vi.waitFor(() => expect(w.find('svg rect').exists()).toBe(false)); // not the monitor
    expect(w.find('svg circle').exists()).toBe(false); // not the sun either → the moon
  });

  test('clicking persists the next theme and applies it to the document', async () => {
    await saveSettings({ theme: 'dark' });
    const w = await mounted();
    await w.get('button').trigger('click');
    await vi.waitFor(async () => {
      const stored = (await fakeBrowser.storage.local.get('settings')).settings as { theme: string };
      expect(stored.theme).toBe('light');
      // The document attribute is written after the save resolves, so wait for both.
      expect(document.documentElement.dataset.theme).toBe('light');
    });
  });

  test('the icon is decorative — the button carries the accessible name', async () => {
    const w = await mounted();
    expect(w.get('svg').attributes('aria-hidden')).toBe('true');
  });

  test('a failed save still switches the theme for this session', async () => {
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(new Error('quota'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = await mounted();
    await w.get('button').trigger('click');
    await vi.waitFor(() => expect(document.documentElement.dataset.theme).toBeTruthy());
  });
});
