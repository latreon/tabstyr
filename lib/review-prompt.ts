import { browser } from 'wxt/browser';

// Standalone storage.local keys — deliberately outside the `settings` object
// so they never round-trip through export/restore/merge (dismissal state is
// local install trivia, not user data worth syncing across devices).
const INSTALLED_AT_KEY = 'installedAt';
const REVIEW_PROMPT_DISMISSED_KEY = 'reviewPromptDismissed';

// Long enough that the prompt only reaches someone who's kept the extension
// past a first impression, short enough to still catch them while engaged.
const PROMPT_AFTER_DAYS = 6;
const DAY_MS = 86_400_000;

// Called once from onInstalled('install'). No-ops on repeat calls (e.g. a
// service-worker restart replaying init) since the key, once set, is never overwritten.
export async function recordInstallDate(now: number): Promise<void> {
  const { [INSTALLED_AT_KEY]: existing } = await browser.storage.local.get(INSTALLED_AT_KEY);
  if (typeof existing !== 'number') {
    await browser.storage.local.set({ [INSTALLED_AT_KEY]: now });
  }
}

export async function shouldShowReviewPrompt(now: number): Promise<boolean> {
  const stored = await browser.storage.local.get([INSTALLED_AT_KEY, REVIEW_PROMPT_DISMISSED_KEY]);
  if (stored[REVIEW_PROMPT_DISMISSED_KEY]) return false;
  const installedAt = stored[INSTALLED_AT_KEY];
  if (typeof installedAt !== 'number') return false;
  return now - installedAt >= PROMPT_AFTER_DAYS * DAY_MS;
}

export async function dismissReviewPrompt(): Promise<void> {
  await browser.storage.local.set({ [REVIEW_PROMPT_DISMISSED_KEY]: true });
}
