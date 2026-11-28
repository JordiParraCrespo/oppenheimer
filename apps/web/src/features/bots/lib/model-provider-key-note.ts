/** What a key row says under its tag, by its place in the order a call tries them. */
export type ModelProviderKeyNote = 'keySpentNote' | 'keyFirst' | 'keyNext';

/**
 * Each key's note, by id: a spent key says it is out of credit; the first not
 * spent is the one a call runs on now; the rest wait for the keys above them.
 * The API's `keysInTurnOrder` decides the same, over the same stored order.
 */
export function modelProviderKeyNotes(
  keys: readonly { id: string; spentAt: Date | null }[],
): Map<string, ModelProviderKeyNote> {
  const now = keys.find((key) => key.spentAt === null)?.id;
  return new Map(
    keys.map((key) => [
      key.id,
      key.spentAt !== null ? 'keySpentNote' : key.id === now ? 'keyFirst' : 'keyNext',
    ]),
  );
}
