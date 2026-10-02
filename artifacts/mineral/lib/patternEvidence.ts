import { collection, doc, onSnapshot, type Unsubscribe } from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  PatternEvidenceListenerState,
  PATTERN_TYPES,
  EVIDENCE_TYPES,
  type EvidencePage,
  type PatternDocuments,
} from "@/lib/patternEvidenceState";

export { PatternEvidenceListenerState } from "@/lib/patternEvidenceState";
export type { EvidencePage, PatternDocuments } from "@/lib/patternEvidenceState";
import type { PatternDoc, PatternType } from "@/types/firestore";

/**
 * Observes root pattern documents and their evidence pages as one coherent
 * generation. During Firestore listener catch-up, the prior coherent result
 * remains visible rather than joining a new root to older overflow pages.
 * A lens may request only its own type so unrelated evidence cannot hold it
 * behind another lens's generation or listener failure.
 */
export function subscribePatternDocuments(
  uid: string,
  onData: (patterns: PatternDocuments) => void,
  onError: (error: Error) => void,
  types: readonly PatternType[] = PATTERN_TYPES
): Unsubscribe {
  const state = new PatternEvidenceListenerState(onData, types);
  let terminated = false;
  const unsubscribes: Unsubscribe[] = [];
  const terminalFailure = (error: Error) => {
    if (terminated) return;
    terminated = true;
    state.fail();
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    onError(error);
  };
  const register = (unsubscribe: Unsubscribe) => {
    if (terminated) unsubscribe();
    else unsubscribes.push(unsubscribe);
  };

  const rootUnsubscribe = types.length === 1 ? onSnapshot(
    doc(db, "users", uid, "patterns", types[0]),
    (snap) => {
      if (!terminated) {
        state.receiveRoots(snap.exists() ? { [types[0]]: snap.data() as PatternDoc } : {});
      }
    },
    terminalFailure
  ) : onSnapshot(
    collection(db, "users", uid, "patterns"),
    (snap) => {
      const next: PatternDocuments = {};
      snap.docs.forEach((doc) => {
        if ((types as readonly string[]).includes(doc.id)) {
          next[doc.id as PatternType] = doc.data() as PatternDoc;
        }
      });
      if (!terminated) state.receiveRoots(next);
    },
    terminalFailure
  );
  register(rootUnsubscribe);
  const pageUnsubscribes = EVIDENCE_TYPES.filter((type) => types.includes(type)).map((type) =>
    onSnapshot(
      collection(db, "users", uid, "patterns", type, "evidence"),
      (snap) => {
        if (!terminated) {
          state.receivePages(type, snap.docs.map((doc) => doc.data() as EvidencePage));
        }
      },
      terminalFailure
    )
  );
  pageUnsubscribes.forEach(register);
  return () => {
    if (terminated) return;
    terminated = true;
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}