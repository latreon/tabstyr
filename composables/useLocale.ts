import { ref } from 'vue';
import { getSettings, saveSettings } from '@/lib/settings';
import { setLocale, resolveLocale } from '@/lib/i18n';

// User preference: 'auto' (follow the browser) or a supported locale code.
const language = ref<string>('auto');

export function useLocale() {
  async function load(): Promise<void> {
    language.value = (await getSettings()).language;
    setLocale(resolveLocale(language.value));
  }

  async function setLanguage(pref: string): Promise<void> {
    language.value = pref;
    await saveSettings({ language: pref });
    setLocale(resolveLocale(pref));
  }

  return { language, load, setLanguage };
}
