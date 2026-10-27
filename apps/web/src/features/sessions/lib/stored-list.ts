/**
 * A list of ids the reader keeps on this device under `key`: the sidebar's
 * pins and folded groups. One reader and one writer, so a corrupt value,
 * private browsing or a full quota are handled once.
 */

/** Anything unreadable, or storage switched off, is an empty list; repeats are dropped. */
export function storedList(key: string): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    return Array.isArray(stored)
      ? [...new Set(stored.filter((id): id is string => typeof id === 'string'))]
      : [];
  } catch {
    return [];
  }
}

export function rememberList(key: string, list: readonly string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Private browsing or a full quota: the list holds until the page reloads.
  }
}
