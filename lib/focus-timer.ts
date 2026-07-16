// A simple, local-only focus/Pomodoro-style countdown. Pure state + formatting
// helpers — the actual scheduling (browser.alarms) and persistence
// (storage.local under the 'focusTimer' key) live in the popup and
// background.ts, same split as session-alert.ts vs. its background caller.

export interface FocusTimerState {
  endsAt: number; // ms epoch when the session completes
  durationMin: number; // kept for display and for the completion notification
}

/** A fresh state for a session starting now. */
export function startFocusTimer(durationMin: number, now: number): FocusTimerState {
  return { endsAt: now + durationMin * 60_000, durationMin };
}

/** Milliseconds left, clamped ≥0 (0 once the session has completed). */
export function remainingMs(state: FocusTimerState | null, now: number): number {
  if (!state) return 0;
  return Math.max(0, state.endsAt - now);
}

/** "MM:SS" countdown display, rounded up so the display never reads 00:00 while time remains. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
