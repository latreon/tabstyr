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
