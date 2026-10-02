import type { PatternType, PractitionerContentDoc } from "../types/firestore";

export type GuideLensTeaching = {
  kind?: string;
  heldLine?: string;
  paragraphs?: string[];
};

/** General lens teaching, never represented as a passage about the hero key. */
export function guideLensTeachingText(content: GuideLensTeaching | null | undefined): string | null {
  if (content?.kind !== "teaching") return null;
  return content.paragraphs?.find((p) => typeof p === "string" && p.trim().length > 0)
    ?? (content.heldLine?.trim() ? content.heldLine : null);
}

export type GuideOfferingTarget = {
  docId: string;
  keyType: "word" | "motif" | "resistance";
};

/** Keys already belong to the engine. In particular, do not re-stem words. */
export function guideOfferingTarget(
  hero: { key: string; type: PatternType } | null
): GuideOfferingTarget | null {
  if (!hero) return null;
  if (hero.type === "thread") {
    return /^[a-z0-9]+$/.test(hero.key)
      ? { docId: `word_${hero.key}`, keyType: "word" }
      : null;
  }
  if (hero.type !== "motif" && hero.type !== "resistance") return null;
  const normalized = hero.key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { docId: `${hero.type}_${normalized}`, keyType: hero.type };
}

/** Mirrors functions/patternEngine.js offeringText, including compatibility
 * selections for motif/resistance. Word top-level text is never approval. */
export function guideOfferingText(
  content: PractitionerContentDoc | null,
  keyType: GuideOfferingTarget["keyType"]
): string | null {
  if (!content) return null;
  const nonempty = (text: unknown): text is string =>
    typeof text === "string" && text.trim().length > 0;
  if (keyType !== "word") return nonempty(content.text) ? content.text : null;
  if (content.status === "draft" || !Array.isArray(content.passages)) return null;
  const approved = content.passages.filter(
    (passage) => passage?.status === "approved" && nonempty(passage.text)
  );
  return approved.find((passage) => passage.text === content.text)?.text
    ?? approved[0]?.text ?? null;
}

export type GuideOfferingHydration = {
  target: GuideOfferingTarget;
  content: PractitionerContentDoc | null;
};

/** Target instances represent subscriptions, not just strings: A → B → A
 * must not resurrect the first A's teaching before the new read arrives. */
export function currentGuideOfferingContent(
  target: GuideOfferingTarget | null,
  hydration: GuideOfferingHydration | null
): PractitionerContentDoc | null {
  return target && hydration?.target === target ? hydration.content : null;
}

/** Cleanup invalidates queued snapshot/error callbacks, even for the same ID. */
export function guideOfferingReceiver(
  target: GuideOfferingTarget,
  publish: (hydration: GuideOfferingHydration) => void
) {
  let active = true;
  return {
    receive(content: PractitionerContentDoc | null) {
      if (active) publish({ target, content });
    },
    close() { active = false; },
  };
}