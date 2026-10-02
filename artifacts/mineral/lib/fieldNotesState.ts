/** The field feed's only server-side ordering clause. */
export const FIELD_NOTES_ORDER_FIELD = "createdAt" as const;

export function shouldShowReflection(
  noteCount: number,
  readingsEnabled: boolean
): boolean {
  return readingsEnabled && noteCount >= 2;
}

export function shouldShowLetter(
  noteCount: number,
  isKeptField: boolean
): boolean {
  return isKeptField && noteCount >= 15;
}