/**
 * Model B — membership is one logical entitlement, `practice`, read ONLY from
 * the server-written profile. Native SDK entitlements never grant access.
 * Pure module (no runtime imports) so node tests can load it directly.
 */

type Millis = { toMillis?: () => number } | null | undefined;

export interface MembershipProfileLike {
  practice?: boolean | null;
  membershipExpiresAt?: Millis;
  membershipInvitationSeen?: boolean | null;
  sequenceDay?: number | null;
}

function expiryMs(p: MembershipProfileLike | null | undefined): number | null {
  const at = p?.membershipExpiresAt;
  if (!at || typeof at.toMillis !== "function") return null;
  const ms = at.toMillis();
  return Number.isFinite(ms) ? ms : null;
}

/** Depth is open only when practice === true AND the expiry is in the future. */
export function practiceActive(p: MembershipProfileLike | null | undefined, now: number): boolean {
  if (p?.practice !== true) return false;
  const ms = expiryMs(p);
  return ms !== null && ms > now;
}

/** Milliseconds until the live clock must close depth, or null if no timer is needed. */
export function msUntilLapse(p: MembershipProfileLike | null | undefined, now: number): number | null {
  if (!practiceActive(p, now)) return null;
  const ms = expiryMs(p) as number;
  // setTimeout overflows above 2^31-1; re-arm later in that case.
  return Math.min(ms - now + 50, 2_147_000_000);
}

/** The day-eight threshold: seven days kept → the invitation, once, ever. */
export const INVITATION_DAY = 8;

export function shouldOfferThresholdInvitation(args: {
  profile: MembershipProfileLike | null | undefined;
  now: number;
  visiting: boolean;
}): boolean {
  const { profile, now, visiting } = args;
  if (!profile || visiting) return false;
  if (profile.membershipInvitationSeen === true) return false;
  return (profile.sequenceDay ?? 1) >= INVITATION_DAY;
}

/** Monotonic: we only ever write `true`, and only when not already true. */
export function invitationSeenUpdate(
  p: MembershipProfileLike | null | undefined
): { membershipInvitationSeen: true } | null {
  return p?.membershipInvitationSeen === true ? null : { membershipInvitationSeen: true };
}

// ── Personalized evidence — only real patterns and notes ──────────────
export interface EvidencePatternLike {
  itemCounts?: Record<string, number>;
  itemNotes?: Record<string, string[]>;
}
export interface InvitationEvidence {
  item: string; // raw pattern key
  count: number; // real return count (≥ 2)
  notes: number; // real note count
  encounters?: number[]; // verified library positions, not capture days
}

/** The strongest real returning item across motif/thread/resistance, or null. */
export function invitationEvidence(
  patterns: Partial<Record<string, EvidencePatternLike | undefined>>,
  noteCount: number,
  noteEncounters: Record<string, number> = {}
): InvitationEvidence | null {
  let best: { item: string; count: number } | null = null;
  let contributing: string[] = [];
  for (const type of ["motif", "thread", "resistance"]) {
    const counts = patterns[type]?.itemCounts ?? {};
    for (const [item, count] of Object.entries(counts)) {
      if (typeof count !== "number" || count < 2) continue;
      if (!best || count > best.count) {
        best = { item, count };
        contributing = patterns[type]?.itemNotes?.[item] ?? [];
      }
    }
  }
  if (!best || noteCount < best.count) return null;
  // A capped/partial note set must never appear to describe all returns.
  const ids = [...new Set(contributing)];
  const complete = ids.length === best.count && ids.every(id =>
    Number.isInteger(noteEncounters[id]) && noteEncounters[id] >= 1 && noteEncounters[id] <= 108);
  return { ...best, notes: noteCount, ...(complete ? {
    encounters: [...new Set(ids.map(id => noteEncounters[id]))].sort((a, b) => a - b),
  } : {}) };
}
