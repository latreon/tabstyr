// Continuous-session nudge: "you've been on {domain} for a while" — a live,
// in-the-moment signal distinct from the once-a-day category BUDGET nudge
// (lib/budgets.ts, cumulative time across the whole day). This measures an
// uninterrupted visit to one domain.
//
// Deliberately NOT built on OpenSession.start: engine.ts's checkpoint() rebases
// `start` to `now` every heartbeat once it emits a slice (so it can track
// "since the last heartbeat", not "since the visit began"). Using it directly
// here would make elapsed time read as ~0 forever. Instead this keeps its own
// clock, keyed on domain identity, read fresh from the engine's live state each
// heartbeat; it naturally resets whenever the continuously-focused domain
// changes or the session ends (idle-close, blur, tab close all surface here as
// the focused domain going null or changing).

export interface SessionAlertState {
  domain: string;
  start: number; // when we first observed `domain` as the continuously-focused one
  notified: boolean;
}

/**
 * Roll `prev` forward to reflect the currently-focused domain. Unchanged while
 * the same domain stays focused; reset (fresh `start`, `notified: false`) when
 * it changes or there's no focused domain at all. Pure state transition — does
 * not decide whether to notify.
 */
export function advanceSessionAlertState(
  focusedDomain: string | null,
  prev: SessionAlertState | null,
  now: number,
): SessionAlertState | null {
  if (!focusedDomain) return null;
  if (prev && prev.domain === focusedDomain) return prev;
  return { domain: focusedDomain, start: now, notified: false };
}

/**
 * Whether the (already-advanced) state should fire the nudge right now: the
 * feature is on, the domain's category is classified 'distracting' (never
 * interrupts a productive/neutral site — that would defeat the point), we
 * haven't already notified for this particular continuous visit, and enough
 * time has passed.
 */
export function shouldNotifySessionAlert(
  state: SessionAlertState | null,
  isDistracting: boolean,
  thresholdMinutes: number,
  now: number,
): boolean {
  if (!state || state.notified || thresholdMinutes <= 0 || !isDistracting) return false;
  return now - state.start >= thresholdMinutes * 60_000;
}
