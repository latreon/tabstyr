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

  test('same-domain navigation keeps session running', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://github.com/a', T0);
    expect(e.handleUrlChange(1, 'https://github.com/b', T0 + 60_000)).toEqual([]);
    expect(e.getState().focused?.start).toBe(T0);
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
