import type { FieldPassage, PractitionerContentDoc } from "@/types/firestore";

/** The client rendering boundary for G2: drafts never reach a screen. */
export function approvedFieldPassages(
  content: Pick<PractitionerContentDoc, "passages"> | null | undefined
): FieldPassage[] {
  return (content?.passages ?? []).filter((passage) => passage.status === "approved");
}

export function firstApprovedFieldPassage(
  content: Pick<PractitionerContentDoc, "passages"> | null | undefined
): FieldPassage | null {
  return approvedFieldPassages(content)[0] ?? null;
}