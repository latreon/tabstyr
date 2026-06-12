import { describe, expect, test } from 'vitest';
import { TrackerEngine } from '@/lib/tracker/engine';

const T0 = 1_000_000_000_000;

describe('TrackerEngine focus/blur', () => {
  test('focus then switch closes previous session', () => {
    const e = new TrackerEngine();
    expect(e.handleFocus(1, 'https://github.com/a', T0)).toEqual([]);
    const closed = e.handleFocus(2, 'https://youtube.com/b', T0 + 60_000);
    expect(closed).toEqual([
      { tabId: 1, url: 'https://github.com/a', domain: 'github.com', start: T0, end: T0 + 60_000, audio: false },
    ]);
  });

  test('blur closes focused session, refocus starts new one', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://github.com/a', T0);
    const closed = e.handleBlur(T0 + 30_000);
    expect(closed).toHaveLength(1);
    expect(closed[0].end - closed[0].start).toBe(30_000);
    expect(e.handleBlur(T0 + 40_000)).toEqual([]); // already blurred — no-op
  });

  test('sessions under 1s are discarded', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    expect(e.handleFocus(2, 'https://b.com', T0 + 500)).toEqual([]);
  });
});

describe('TrackerEngine idle', () => {
  test('idle closes focused session; focus event clears idle', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    const closed = e.handleIdle(T0 + 120_000);
    expect(closed).toHaveLength(1);
    expect(e.getState().isIdle).toBe(true);
    e.handleFocus(1, 'https://a.com', T0 + 300_000);
    expect(e.getState().isIdle).toBe(false);
    expect(e.getState().focused?.start).toBe(T0 + 300_000);
  });
});

describe('TrackerEngine checkpoint', () => {
  test('closes and reopens open sessions at now', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    const closed = e.checkpoint(T0 + 60_000);
    expect(closed).toHaveLength(1);
    expect(closed[0].end).toBe(T0 + 60_000);
    expect(e.getState().focused?.start).toBe(T0 + 60_000);
  });
});

describe('TrackerEngine state round-trip', () => {
  test('serializes and restores', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    const restored = new TrackerEngine(e.getState());
    const closed = restored.handleBlur(T0 + 10_000);
    expect(closed).toHaveLength(1);
    expect(closed[0].tabId).toBe(1);
  });
});

describe('TrackerEngine reconcile', () => {
  test('closes sessions for tabs that no longer exist', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    const closed = e.reconcile(new Set([2, 3]), T0 + 5_000);
    expect(closed).toHaveLength(1);
    expect(e.getState().focused).toBeNull();
  });

  test('keeps sessions for live tabs', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    expect(e.reconcile(new Set([1]), T0 + 5_000)).toEqual([]);
    expect(e.getState().focused?.tabId).toBe(1);
  });
});

describe('TrackerEngine boundary safety', () => {
  test('getState returns copies — mutating them does not corrupt engine', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    const state = e.getState();
    state.focused!.start = 0;
    expect(e.getState().focused?.start).toBe(T0);
  });

  test('checkpoint keeps sub-1s elapsed time instead of discarding it', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    expect(e.checkpoint(T0 + 500)).toEqual([]); // nothing emitted
    expect(e.getState().focused?.start).toBe(T0); // start NOT reset
    const closed = e.checkpoint(T0 + 1500);
    expect(closed).toHaveLength(1);
    expect(closed[0].start).toBe(T0); // full elapsed window kept
  });

  test('does not track internal pages (chrome://, newtab, extension)', () => {
    const e = new TrackerEngine();
    expect(e.handleFocus(1, 'chrome://settings', T0)).toEqual([]);
    expect(e.getState().focused).toBeNull();
    // focusing a web page then an internal one closes the web session and stops
    e.handleFocus(2, 'https://a.com', T0);
    const closed = e.handleFocus(3, 'chrome://newtab', T0 + 60_000);
    expect(closed).toHaveLength(1);
    expect(closed[0].domain).toBe('a.com');
    expect(e.getState().focused).toBeNull();
  });

  test('caps an absurdly long session (system sleep/suspend) at the 30-minute bound', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    const closed = e.handleBlur(T0 + 8 * 60 * 60_000); // "focused" across an 8h sleep
    expect(closed).toHaveLength(1);
    expect(closed[0].end - closed[0].start).toBe(30 * 60_000); // not 8 hours
  });

  test('does NOT clip a 25-minute continuous session (e.g. watching a video)', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://youtube.com/watch', T0);
    const closed = e.handleBlur(T0 + 25 * 60_000); // 25 min, no heartbeat in between
    expect(closed).toHaveLength(1);
    expect(closed[0].end - closed[0].start).toBe(25 * 60_000); // counted in full
  });

  test('caps a multi-hour audio session at the bound too', () => {
    const e = new TrackerEngine();
    e.syncAudio([{ tabId: 2, url: 'https://music.com/x' }], T0);
    const closed = e.checkpoint(T0 + 3 * 60 * 60_000); // 3h with no heartbeat (asleep)
    expect(closed).toHaveLength(1);
    expect(closed[0].end - closed[0].start).toBe(30 * 60_000);
  });

  test('same-tab refocus (navigation) closes old session and opens new url', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com/x', T0);
    const closed = e.handleFocus(1, 'https://a.com/y', T0 + 5_000);
    expect(closed).toHaveLength(1);
    expect(e.getState().focused?.url).toBe('https://a.com/y');
  });

  test('focusing a tab restored with a background audio session converts it', () => {
    const e = new TrackerEngine({
      focused: null,
      audio: [{ tabId: 2, url: 'https://yt.com/v', domain: 'yt.com', start: T0, audio: true }],
      isIdle: false,
    });
    const closed = e.handleFocus(2, 'https://yt.com/v', T0 + 60_000);
    expect(closed).toHaveLength(1);
    expect(closed[0].audio).toBe(true);
    expect(e.getState().audio).toEqual([]);
    expect(e.getState().focused?.tabId).toBe(2);
  });

  test('reconcile closes audio sessions for dead tabs', () => {
    const e = new TrackerEngine({
      focused: null,
      audio: [{ tabId: 2, url: 'https://yt.com/v', domain: 'yt.com', start: T0, audio: true }],
      isIdle: false,
    });
    const closed = e.reconcile(new Set([1]), T0 + 5_000);
    expect(closed).toHaveLength(1);
    expect(e.getState().audio).toEqual([]);
  });
});
