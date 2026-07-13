import { describe, expect, test } from 'vitest';
import { advanceSessionAlertState, shouldNotifySessionAlert, type SessionAlertState } from '@/lib/tracker/session-alert';

const MIN = 60_000;

describe('advanceSessionAlertState', () => {
  test('starts fresh state for a newly-focused domain', () => {
    expect(advanceSessionAlertState('reddit.com', null, 1000)).toEqual({ domain: 'reddit.com', start: 1000, notified: false });
  });

  test('keeps the same state (start/notified untouched) while the domain stays focused', () => {
    const prev: SessionAlertState = { domain: 'reddit.com', start: 1000, notified: false };
    expect(advanceSessionAlertState('reddit.com', prev, 5000)).toBe(prev); // same object, not just equal
  });

  test('resets to a fresh state when the focused domain changes', () => {
    const prev: SessionAlertState = { domain: 'reddit.com', start: 1000, notified: true };
    expect(advanceSessionAlertState('github.com', prev, 5000)).toEqual({ domain: 'github.com', start: 5000, notified: false });
  });

  test('clears state when nothing is focused (session ended)', () => {
    const prev: SessionAlertState = { domain: 'reddit.com', start: 1000, notified: false };
    expect(advanceSessionAlertState(null, prev, 5000)).toBeNull();
  });
});

describe('shouldNotifySessionAlert', () => {
  const distractingSince = (start: number): SessionAlertState => ({ domain: 'reddit.com', start, notified: false });

  test('fires once the threshold minutes have elapsed on a distracting site', () => {
    const state = distractingSince(0);
    expect(shouldNotifySessionAlert(state, true, 30, 30 * MIN)).toBe(true);
    expect(shouldNotifySessionAlert(state, true, 30, 29 * MIN)).toBe(false);
  });

  test('never fires for a productive or neutral site', () => {
    const state = distractingSince(0);
    expect(shouldNotifySessionAlert(state, false, 30, 30 * MIN)).toBe(false);
  });

  test('never fires when the feature is off (threshold 0)', () => {
    const state = distractingSince(0);
    expect(shouldNotifySessionAlert(state, true, 0, 30 * MIN)).toBe(false);
  });

  test('does not re-fire once already notified for this continuous visit', () => {
    const state: SessionAlertState = { domain: 'reddit.com', start: 0, notified: true };
    expect(shouldNotifySessionAlert(state, true, 30, 60 * MIN)).toBe(false);
  });

  test('never fires with no active session', () => {
    expect(shouldNotifySessionAlert(null, true, 30, 1_000_000)).toBe(false);
  });
});
