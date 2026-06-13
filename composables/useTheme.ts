import { onMounted, onUnmounted, ref } from 'vue';
import { getSettings, saveSettings } from '@/lib/settings';
import { cacheTheme } from '@/lib/theme-cache';
import type { ThemeSetting } from '@/lib/types';

export function resolveTheme(setting: ThemeSetting, systemPrefersDark: boolean): 'dark' | 'light' {
  if (setting === 'system') return systemPrefersDark ? 'dark' : 'light';
  return setting;
}

// "system" is the implicit default (when unset); the toggle only flips dark/light.
const CYCLE: ThemeSetting[] = ['dark', 'light'];

// Module-scope ref so all useTheme() instances share state
const setting = ref<ThemeSetting>('system');

export function useTheme() {
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function apply() {
    document.documentElement.dataset.theme = resolveTheme(setting.value, media.matches);
    cacheTheme(setting.value); // keep the sync pre-paint mirror current
  }

  async function cycle() {
    setting.value = CYCLE[(CYCLE.indexOf(setting.value) + 1) % CYCLE.length];
    await saveSettings({ theme: setting.value });
    apply();
  }

  async function set(next: ThemeSetting) {
    setting.value = next;
    await saveSettings({ theme: next });
    apply();
  }

  onMounted(async () => {
    setting.value = (await getSettings()).theme;
    apply();
    media.addEventListener('change', apply);
  });
  onUnmounted(() => media.removeEventListener('change', apply));

  return { setting, cycle, set };
}
