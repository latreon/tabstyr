import { describe, expect, test } from 'vitest';
import { TrackerEngine } from '@/lib/tracker/engine';

const T0 = 1_000_000_000_000;

describe('TrackerEngine.syncAudio', () => {
  test('opens audio session for audible background tab, closes when it stops', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://docs.com', T0);
    expect(e.syncAudio([{ tabId: 2, url: 'https://youtube.com/v' }], T0)).toEqual([]);
    const closed = e.syncAudio([], T0 + 90_000);
    expect(closed).toEqual([
      { tabId: 2, url: 'https://youtube.com/v', domain: 'youtube.com', start: T0, end: T0 + 90_000, audio: true },
    ]);
  });

  test('never opens an audio session for the focused tab', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://youtube.com/v', T0);
    e.syncAudio([{ tabId: 1, url: 'https://youtube.com/v' }], T0);
    expect(e.getState().audio).toEqual([]);
  });

  test('focusing an audio tab converts it: audio session closes, focused opens', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://docs.com', T0);
    e.syncAudio([{ tabId: 2, url: 'https://youtube.com/v' }], T0);
    const closed = e.handleFocus(2, 'https://youtube.com/v', T0 + 60_000);
    expect(closed).toHaveLength(2); // old focused + old audio
    expect(closed.find((s) => s.audio)?.tabId).toBe(2);
    expect(e.getState().focused?.tabId).toBe(2);
    expect(e.getState().audio).toEqual([]);
  });

  test('idle stops background audio too', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://docs.com', T0);
    e.syncAudio([{ tabId: 2, url: 'https://youtube.com/v' }], T0);
    const closed = e.handleIdle(T0 + 30_000);
    expect(e.getState().audio).toEqual([]);
    expect(closed.some((s) => s.audio)).toBe(true);
  });

  test('ignores audio from internal pages', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://docs.com', T0);
    e.syncAudio([{ tabId: 2, url: 'chrome://newtab' }], T0);
    expect(e.getState().audio).toEqual([]);
  });
});

describe('TrackerEngine.handleUrlChange', () => {
  test('domain change closes session and opens new one under new domain', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://github.com/a', T0);
    const closed = e.handleUrlChange(1, 'https://youtube.com/b', T0 + 60_000);
    expect(closed).toHaveLength(1);
    expect(closed[0].domain).toBe('github.com');
    expect(e.getState().focused?.domain).toBe('youtube.com');
  });

  test('same-domain sub-page navigation splits the session (SPA attribution)', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://github.com/a', T0);
    const closed = e.handleUrlChange(1, 'https://github.com/b', T0 + 60_000);
    expect(closed).toHaveLength(1);
    expect(closed[0]).toMatchObject({ domain: 'github.com', url: 'https://github.com/a' });
    // New segment opens on the new sub-page, starting now.
    expect(e.getState().focused).toMatchObject({ url: 'https://github.com/b', start: T0 + 60_000 });
  });

  test('navigation to the same page (query/anchor only) does not split', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://github.com/a', T0);
    // query + bare anchor are stripped by pageOf, so this is the same page → no split
    expect(e.handleUrlChange(1, 'https://github.com/a?tab=x#frag', T0 + 60_000)).toEqual([]);
    expect(e.getState().focused?.start).toBe(T0);
  });

  test('hash-router (#/) route change splits the session', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://mail.app/#/inbox', T0);
    const closed = e.handleUrlChange(1, 'https://mail.app/#/sent', T0 + 60_000);
    expect(closed).toHaveLength(1);
    expect(closed[0].url).toBe('https://mail.app/#/inbox');
    expect(e.getState().focused?.url).toBe('https://mail.app/#/sent');
  });

  test('sub-1s sub-page churn is not dropped — time rolls into the new page', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://github.com/a', T0);
    // 500ms on /a then navigate: nothing emitted, but start is preserved on /b
    expect(e.handleUrlChange(1, 'https://github.com/b', T0 + 500)).toEqual([]);
    expect(e.getState().focused).toMatchObject({ url: 'https://github.com/b', start: T0 });
  });

  test('domain change on audio tab closes audio session and opens new one', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://docs.com', T0);
    e.syncAudio([{ tabId: 2, url: 'https://spotify.com/a' }], T0);
    const closed = e.handleUrlChange(2, 'https://ads.com/redirect', T0 + 45_000);
    expect(closed).toHaveLength(1);
    expect(closed[0]).toMatchObject({ tabId: 2, domain: 'spotify.com', audio: true });
    expect(e.getState().audio[0].domain).toBe('ads.com');
    expect(e.getState().audio[0].start).toBe(T0 + 45_000);
  });

  test('same-domain navigation on audio tab does not split session', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://docs.com', T0);
    e.syncAudio([{ tabId: 2, url: 'https://spotify.com/a' }], T0);
    expect(e.handleUrlChange(2, 'https://spotify.com/b', T0 + 30_000)).toEqual([]);
    expect(e.getState().audio[0].start).toBe(T0);
  });
});

describe('TrackerEngine idle + media', () => {
  test('keeps counting a focused media tab through idle, then closes it once media stops', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://youtube.com/v', T0, true); // watching a video
    // User goes idle while the video plays — session stays open.
    expect(e.handleIdle(T0 + 60_000)).toEqual([]);
    expect(e.getState().focused).not.toBeNull();
    // A heartbeat while still watching still accrues time.
    expect(e.checkpoint(T0 + 120_000)).toHaveLength(1);
    // Video ends: the heartbeat marks the focused tab silent, then checkpoints.
    e.setFocusedAudible(false);
    const closed = e.checkpoint(T0 + 180_000);
    // The tail since the last checkpoint is booked once, then the session closes —
    // no further slices accrue while the user stays idle (no phantom time).
    expect(closed).toHaveLength(1);
    expect(e.getState().focused).toBeNull();
    expect(e.checkpoint(T0 + 600_000)).toEqual([]);
  });
});

describe('TrackerEngine.handleTabRemoved', () => {
  test('closes focused and audio sessions for the removed tab', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    e.syncAudio([{ tabId: 2, url: 'https://b.com' }], T0);
    expect(e.handleTabRemoved(1, T0 + 10_000)).toHaveLength(1);
    expect(e.handleTabRemoved(2, T0 + 20_000)).toHaveLength(1);
    expect(e.getState().focused).toBeNull();
    expect(e.getState().audio).toEqual([]);
  });
});
