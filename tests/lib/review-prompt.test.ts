import { beforeEach, describe, expect, test } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { recordInstallDate, shouldShowReviewPrompt, dismissReviewPrompt } from '@/lib/review-prompt';

const DAY_MS = 86_400_000;

describe('review-prompt', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  test('never shows before an install date is recorded', async () => {
    expect(await shouldShowReviewPrompt(Date.now())).toBe(false);
  });

  test('stays hidden before the 6-day threshold', async () => {
    const installedAt = Date.now();
    await recordInstallDate(installedAt);
    expect(await shouldShowReviewPrompt(installedAt + 5 * DAY_MS)).toBe(false);
  });

  test('shows once 6 days have elapsed since install', async () => {
    const installedAt = Date.now();
    await recordInstallDate(installedAt);
    expect(await shouldShowReviewPrompt(installedAt + 6 * DAY_MS)).toBe(true);
  });

  test('recordInstallDate does not overwrite an existing install date', async () => {
    const first = Date.now();
    await recordInstallDate(first);
    await recordInstallDate(first + 10 * DAY_MS); // e.g. a worker restart replaying init
    // Still measured from the original install, so the prompt is due at +6d from `first`.
    expect(await shouldShowReviewPrompt(first + 6 * DAY_MS)).toBe(true);
  });

  test('dismissal is permanent even after the threshold passes', async () => {
    const installedAt = Date.now();
    await recordInstallDate(installedAt);
    await dismissReviewPrompt();
    expect(await shouldShowReviewPrompt(installedAt + 30 * DAY_MS)).toBe(false);
  });
});
