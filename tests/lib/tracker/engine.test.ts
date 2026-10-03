import { describe, expect, test } from 'vitest';
import { TrackerEngine } from '@/lib/tracker/engine';

const T0 = 1_000_000_000_000;

describe('TrackerEngine focus/blur', () => {
  test('focus then switch closes previous session', () => {
    const e = new TrackerEngine();
    expect(e.handleFocus(1, 'https://github.com/a', T0)).toEqual([]);
    const closed = e.handleFocus(2, 'https://youtube.com/b', T0 + 60_000);
    expect(closed).toEqual([
      { tabId: 1, url: 'https://github.com/a', domain: 'github.com', start: T0, end: T0 + 60_000, audio: false, audible: false },
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

  test('sessions under the minimum are discarded, but a brief real visit is kept', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    expect(e.handleFocus(2, 'https://b.com', T0 + 100)).toEqual([]); // below MIN_SESSION_MS
    // 500ms IS a real (if brief) visit and is now recorded rather than thrown away.
    const closed = e.handleFocus(3, 'https://c.com', T0 + 600);
    expect(closed).toHaveLength(1);
    expect(closed[0].end - closed[0].start).toBe(500);
  });

  test('redundant re-focus of the same tab+page keeps the session, loses no time', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com/x', T0);
    // windows.onFocusChanged + tabs.onActivated both fire for the same cross-window
    // tab switch, milliseconds apart — must NOT close + reopen the session.
    const dup = e.handleFocus(1, 'https://a.com/x', T0 + 5, true);
    expect(dup).toEqual([]);
    expect(e.getState().focused?.start).toBe(T0); // original start preserved
    expect(e.getState().focused?.audible).toBe(true); // media flag refreshed
    // The full minute is still counted on the next real switch (not T0+5 → ...).
    const next = e.handleFocus(2, 'https://b.com', T0 + 60_000);
    expect(next[0].end - next[0].start).toBe(60_000);
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

  test('re-bases live sessions on wake — emits elapsed and resets start', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    const closed = e.reconcile(new Set([1]), T0 + 5_000);
    expect(closed).toHaveLength(1);
    expect(closed[0].end).toBe(T0 + 5_000);
    expect(e.getState().focused?.tabId).toBe(1);
    expect(e.getState().focused?.start).toBe(T0 + 5_000);
  });

  // Continuity is lost on a service-worker cold start; the gap may be a long
  // sleep. A live media tab must NOT book the whole offline duration.
  test('force-caps a live media tab across a long gap', () => {
    const e = new TrackerEngine({
      focused: { tabId: 1, url: 'https://yt.com/v', domain: 'yt.com', start: T0, audio: false, audible: true },
      audio: [],
      isIdle: false,
    });
    const closed = e.reconcile(new Set([1]), T0 + 8 * 3_600_000); // 8h later
    expect(closed).toHaveLength(1);
    // Over the cap ⇒ the heartbeat was missed, so only one heartbeat of grace is
    // credited (NOT the 30-minute cap, which was 30 min of phantom time per wake).
    expect(closed[0].end).toBe(T0 + 60_000);
    expect(e.getState().focused?.start).toBe(T0 + 8 * 3_600_000);
  });

  test('force-caps a dead media (audio) tab — no uncapped overcount', () => {
    const e = new TrackerEngine({
      focused: null,
      audio: [{ tabId: 2, url: 'https://yt.com/v', domain: 'yt.com', start: T0, audio: true }],
      isIdle: false,
    });
    const closed = e.reconcile(new Set([1]), T0 + 8 * 3_600_000);
    expect(closed).toHaveLength(1);
    expect(closed[0].end).toBe(T0 + 60_000); // one heartbeat of grace, not start + 8h
    expect(e.getState().audio).toEqual([]);
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

  test('getState also defensively copies background-audio sessions', () => {
    const e = new TrackerEngine();
    e.syncAudio([{ tabId: 2, url: 'https://music.example/song' }], T0);
    const state = e.getState();
    state.audio[0].start = 0;
    state.audio.push({ tabId: 3, url: 'https://fake.example', domain: 'fake.example', start: 0, audio: true });
    expect(e.getState().audio).toEqual([
      { tabId: 2, url: 'https://music.example/song', domain: 'music.example', start: T0, audio: true },
    ]);
  });

  test('accepts exactly the minimum duration and exact caps without clipping', () => {
    const brief = new TrackerEngine();
    brief.handleFocus(1, 'https://a.com', T0);
    expect(brief.handleBlur(T0 + 250)[0].end - T0).toBe(250);

    const regular = new TrackerEngine();
    regular.handleFocus(1, 'https://a.com', T0);
    expect(regular.handleBlur(T0 + 30 * 60_000)[0].end - T0).toBe(30 * 60_000);

    const media = new TrackerEngine();
    media.handleFocus(1, 'https://video.example/watch', T0, true);
    expect(media.handleBlur(T0 + 24 * 60 * 60_000)[0].end - T0).toBe(24 * 60 * 60_000);
  });

  test('checkpoint keeps sub-minimum elapsed time instead of discarding it', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    expect(e.checkpoint(T0 + 100)).toEqual([]); // below MIN_SESSION_MS — nothing emitted
    expect(e.getState().focused?.start).toBe(T0); // start NOT reset
    const closed = e.checkpoint(T0 + 1500);
    expect(closed).toHaveLength(1);
    expect(closed[0].start).toBe(T0); // full elapsed window kept
  });

  test('records a brief sub-second visit instead of dropping it', () => {
    // Twenty ~900ms visits used to store nothing at all (MIN_SESSION_MS was 1000),
    // silently losing 18s of genuine browsing while flicking through tabs.
    const e = new TrackerEngine();
    let total = 0;
    for (let i = 0; i < 20; i++) {
      for (const s of e.handleFocus(i, `https://site${i}.com/`, T0 + i * 900)) total += s.end - s.start;
    }
    expect(total).toBe(19 * 900); // every closed visit counted (the 20th is still open)
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

  test('credits only a heartbeat of grace for a long NON-media session (likely sleep)', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0); // not audible
    const closed = e.handleBlur(T0 + 8 * 60 * 60_000); // "focused" across an 8h sleep
    expect(closed).toHaveLength(1);
    expect(closed[0].end - closed[0].start).toBe(60_000); // not 8 hours, and not 30 min
  });

  test('a normal close well inside the cap keeps its real duration', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    const closed = e.handleBlur(T0 + 12 * 60_000); // 12 real minutes of reading
    expect(closed[0].end - closed[0].start).toBe(12 * 60_000); // grace never clips real time
  });

  test('counts a long video watched without input in full (audible, uncapped)', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://youtube.com/watch', T0, true); // audible = playing media
    const closed = e.handleBlur(T0 + 2 * 60 * 60_000); // a 2h movie, no events in between
    expect(closed).toHaveLength(1);
    expect(closed[0].end - closed[0].start).toBe(2 * 60 * 60_000); // full 2 hours
  });

  test('caps even a media session at the 24h absolute ceiling (forward clock jump)', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://youtube.com/watch', T0, true); // audible — normally uncapped
    // System clock jumps 3 days forward while the session is open (NTP/VM resume).
    const closed = e.handleBlur(T0 + 3 * 24 * 60 * 60_000);
    expect(closed).toHaveLength(1);
    // Past the 24h ceiling the timestamp is bogus, so credit grace only.
    expect(closed[0].end - closed[0].start).toBe(60_000); // not 3 days of bogus time
  });

  test('drops a session when the clock jumps backward (now < start)', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    expect(e.handleBlur(T0 - 60_000)).toEqual([]); // negative duration — no row stored
  });

  test('keeps an audible (media) tab counting through idle', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://youtube.com/watch', T0, true);
    const closed = e.handleIdle(T0 + 5 * 60_000);
    expect(closed).toEqual([]); // still watching — not closed
    expect(e.getState().focused?.tabId).toBe(1);
  });

  test('continuous background audio counts fully across regular heartbeats', () => {
    const e = new TrackerEngine();
    e.syncAudio([{ tabId: 2, url: 'https://music.com/x' }], T0);
    // The heartbeat fires every minute; an hour of playback accrues as 60 slices.
    let total = 0;
    for (let m = 1; m <= 60; m++) {
      for (const s of e.checkpoint(T0 + m * 60_000)) total += s.end - s.start;
    }
    expect(total).toBe(60 * 60_000); // full hour, no clipping of genuine playback
  });

  test('checkpoint force-caps a media session across a long unobserved gap (sleep)', () => {
    const e = new TrackerEngine();
    e.syncAudio([{ tabId: 2, url: 'https://music.com/x' }], T0);
    // No heartbeat for 4h means the worker was stalled (system slept), not 4h of
    // real listening — credit one heartbeat of grace instead of booking 4h.
    const closed = e.checkpoint(T0 + 4 * 60 * 60_000);
    expect(closed[0].end - closed[0].start).toBe(60_000);
  });

  test('lock/sleep caps everything, even media sessions', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://youtube.com/watch', T0, true);
    e.syncAudio([{ tabId: 2, url: 'https://music.com/x' }], T0);
    const closed = e.handleLocked(T0 + 3 * 60 * 60_000); // screen locked for 3h
    for (const s of closed) expect(s.end - s.start).toBe(60_000);
    expect(e.getState().focused).toBeNull();
    expect(e.getState().audio).toEqual([]);
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

  // A heartbeat that fires far past the cap (alarm throttled) emits only the
  // grace slice and resets start to now — time beyond the cap is intentionally
  // dropped (treated as a likely sleep gap, not real use).
  test('checkpoint past the cap emits one heartbeat of grace and resets start', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0); // non-media
    const closed = e.checkpoint(T0 + 45 * 60_000);
    expect(closed).toHaveLength(1);
    expect(closed[0].end - closed[0].start).toBe(60_000);
    expect(e.getState().focused?.start).toBe(T0 + 45 * 60_000); // start advanced to now
    // The next minute then accrues normally from the new start.
    const next = e.checkpoint(T0 + 46 * 60_000);
    expect(next[0].end - next[0].start).toBe(60_000);
  });
});

describe('TrackerEngine onReplaced (tabId remap)', () => {
  test('remaps the focused session to the new id and keeps counting', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    expect(e.handleTabReplaced(1, 99, T0 + 10_000)).toEqual([]); // continuous — nothing closed
    expect(e.getState().focused?.tabId).toBe(99);
    // Closing later credits the FULL duration to the new id, uninterrupted.
    const closed = e.handleTabRemoved(99, T0 + 60_000);
    expect(closed).toHaveLength(1);
    expect(closed[0].tabId).toBe(99);
    expect(closed[0].end - closed[0].start).toBe(60_000);
  });

  test('remaps a background-audio session to the new id', () => {
    const e = new TrackerEngine({
      focused: null,
      audio: [{ tabId: 2, url: 'https://yt.com/v', domain: 'yt.com', start: T0, audio: true }],
      isIdle: false,
    });
    e.handleTabReplaced(2, 77, T0 + 5_000);
    expect(e.getState().audio.map((a) => a.tabId)).toEqual([77]);
  });

  test('is a no-op for an untracked id', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    expect(e.handleTabReplaced(5, 6, T0 + 1_000)).toEqual([]);
    expect(e.getState().focused?.tabId).toBe(1); // unchanged
  });
});

describe('markActive', () => {
  test('clears the idle flag so a playing media session is not force-closed', () => {
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://yt.com/watch', T0, true); // focused + audible
    e.handleIdle(T0 + 60_000); // no input: the video keeps counting, but idle is set
    expect(e.getState().isIdle).toBe(true);
    expect(e.getState().focused).not.toBeNull();

    // The user comes back on an untrackable tab (internal page / private window), so
    // no handleFocus runs. Without markActive the flag stayed set and the next
    // checkpoint force-closed the still-playing session as though they were away.
    e.markActive();
    expect(e.getState().isIdle).toBe(false);

    const closed = e.checkpoint(T0 + 90_000);
    expect(closed).toHaveLength(1); // a normal heartbeat slice...
    expect(e.getState().focused?.start).toBe(T0 + 90_000); // ...and the session lives on
  });

  test('an idle non-media session is still closed by the next checkpoint', () => {
    // markActive is the ONLY thing that clears the flag here; nothing about it should
    // resurrect a session that idling legitimately ended.
    const e = new TrackerEngine();
    e.handleFocus(1, 'https://a.com', T0);
    e.handleIdle(T0 + 60_000);
    expect(e.getState().focused).toBeNull();
    expect(e.checkpoint(T0 + 90_000)).toEqual([]);
  });
});
