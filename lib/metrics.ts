/**
 * Active foreground seconds for a stat row. Stored `seconds` includes time a tab
 * spent playing background audio; subtracting `audioSeconds` leaves the foreground
 * (active) engagement, which is the primary metric shown across the app. Clamped at
 * 0 to stay robust against any rounding skew between the two fields.
 */
export function activeSeconds(s: { seconds: number; audioSeconds: number }): number {
  return Math.max(0, s.seconds - s.audioSeconds);
}
