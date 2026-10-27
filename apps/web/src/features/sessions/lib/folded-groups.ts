/**
 * The sidebar's project groups the reader folded, kept on this device like
 * the pins (`session-pins.ts`): the groups' keys, a project's id or
 * `unfiled`. A fold is the reader's, so the API never hears of it.
 */
export const FOLDED_GROUPS_KEY = 'oppenheimer.sidebar.folded';

/** `folded` with `key` folded, or opened. */
export function withFold(folded: readonly string[], key: string, open: boolean): string[] {
  const rest = folded.filter((foldedKey) => foldedKey !== key);
  return open ? rest : [...rest, key];
}
