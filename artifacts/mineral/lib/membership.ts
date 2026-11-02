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
}
export interface InvitationEvidence {
  item: string; // raw pattern key
  count: number; // real return count (≥ 2)
  notes: number; // real note count
}

/** The strongest real returning item across motif/thread/resistance, or null. */
export function invitationEvidence(
  patterns: Partial<Record<string, EvidencePatternLike | undefined>>,
  noteCount: number
): InvitationEvidence | null {
  let best: { item: string; count: number } | null = null;
  for (const type of ["motif", "thread", "resistance"]) {
    const counts = patterns[type]?.itemCounts ?? {};
    for (const [item, count] of Object.entries(counts)) {
      if (typeof count !== "number" || count < 2) continue;
      if (!best || count > best.count) best = { item, count };
    }
  }
  if (!best || noteCount < best.count) return null;
  return { ...best, notes: noteCount };
}
