/**
 * Ephemeral hand-off for visit framing (§9 → §11).
 *
 * When the user taps a past day on the turn wheel, the Origin tab records the
 * visited day here before navigating to the Threshold screen. The Threshold
 * consumes (and clears) it on focus. Deliberately not router params: tab
 * screens stay mounted and would hold stale params across later visits.
 */

let visitDay: number | null = null;

export function setVisitDay(day: number): void {
  visitDay = day;
}

/** Read and clear — a visit is honored once. */
export function consumeVisitDay(): number | null {
  const d = visitDay;
  visitDay = null;
  return d;
}
