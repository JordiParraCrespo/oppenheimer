/**
 * The sidebar's project groups the reader folded, kept on this device the way
 * the pins are (`session-pins.ts`): the groups' keys, a project's id or
 * `unfiled`. A fold is the reader's, so the API never hears of it.
 */
export const FOLDED_GROUPS_KEY = 'oppenheimer.sidebar.folded';

/** Anything unreadable, or storage switched off, is no fold. */
export function storedFoldedGroups(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(FOLDED_GROUPS_KEY) ?? 'null');
    return Array.isArray(stored)
      ? [...new Set(stored.filter((key): key is string => typeof key === 'string'))]
      : [];
  } catch {
    return [];
  }
}

export function rememberFoldedGroups(folded: readonly string[]) {
  try {
    window.localStorage.setItem(FOLDED_GROUPS_KEY, JSON.stringify(folded));
  } catch {
    // Private browsing or a full quota: the folds hold until the page reloads.
  }
}

/** `folded` with `key` folded, or opened. */
export function withFold(folded: readonly string[], key: string, open: boolean): string[] {
  const rest = folded.filter((foldedKey) => foldedKey !== key);
  return open ? rest : [...rest, key];
}
