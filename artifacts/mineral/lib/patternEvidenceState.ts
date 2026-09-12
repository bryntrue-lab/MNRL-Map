import type { PatternDoc, PatternType } from "@/types/firestore";

export type PatternDocuments = Partial<Record<PatternType, PatternDoc>>;

export type EvidencePage = {
  evidenceGeneration?: number;
  pageIndex?: number;
  exemplars?: PatternDoc["exemplars"];
};

export const PATTERN_TYPES: PatternType[] = [
  "thread",
  "motif",
  "resistance",
  "conditions",
  "consciousness",
];

export const EVIDENCE_TYPES: PatternType[] = ["thread", "motif", "resistance"];

/**
 * Pure listener state. It only emits a root when every required evidence page
 * belongs to the root's generation. A terminal listener failure clears the
 * previous coherent result and makes later cached callbacks inert.
 */
export class PatternEvidenceListenerState {
  private roots: PatternDocuments = {};
  private rootsReady = false;
  private readonly pages = new Map<PatternType, EvidencePage[]>();
  private readonly pagesReady = new Set<PatternType>();
  private stopped = false;
  private readonly onData: (patterns: PatternDocuments) => void;

  constructor(onData: (patterns: PatternDocuments) => void) {
    this.onData = onData;
  }

  receiveRoots(roots: PatternDocuments) {
    if (this.stopped) return;
    this.roots = roots;
    this.rootsReady = true;
    this.emitIfCoherent();
  }

  receivePages(type: PatternType, pages: EvidencePage[]) {
    if (this.stopped) return;
    this.pages.set(type, pages);
    this.pagesReady.add(type);
    this.emitIfCoherent();
  }

  fail() {
    if (this.stopped) return;
    this.stopped = true;
    this.roots = {};
    this.pages.clear();
    this.pagesReady.clear();
    this.onData({});
  }

  private emitIfCoherent() {
    if (!this.rootsReady || EVIDENCE_TYPES.some((type) => !this.pagesReady.has(type))) return;
    const hydrated: PatternDocuments = {};
    for (const type of PATTERN_TYPES) {
      const root = this.roots[type];
      if (!root) continue;
      const pageCount = Number(root.evidencePageCount ?? 0);
      if (!Number.isInteger(pageCount) || pageCount < 0) return;
      if (pageCount === 0) {
        hydrated[type] = root;
        continue;
      }
      const generation = root.evidenceGeneration;
      const matching = (this.pages.get(type) ?? [])
        .filter((page) => page.evidenceGeneration === generation)
        .sort((left, right) => Number(left.pageIndex) - Number(right.pageIndex));
      if (
        matching.length !== pageCount ||
        matching.some((page, index) => page.pageIndex !== index)
      ) {
        return;
      }
      const exemplars: PatternDoc["exemplars"] = { ...(root.exemplars ?? {}) };
      for (const page of matching) {
        for (const [key, entries] of Object.entries(page.exemplars ?? {})) {
          exemplars[key] = [...entries, ...(exemplars[key] ?? [])];
        }
      }
      hydrated[type] = { ...root, exemplars };
    }
    this.onData(hydrated);
  }
}