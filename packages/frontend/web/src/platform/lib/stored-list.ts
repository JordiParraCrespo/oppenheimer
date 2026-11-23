/**
 * A list of ids the reader keeps on this device under `key`: the sidebar's
 * pins and folded groups, the sections whose Bots heading is folded. One reader and one writer, so a corrupt value,
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

/** Whether storage took `list`: private browsing or a full quota refuse it. */
export function rememberList(key: string, list: readonly string[]): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/**
 * The lists outside React, one per key for the whole page, so every reader of
 * a key sees a change the moment any of them makes it, and a change another
 * tab writes arrives through the `storage` event (`useStoredList`). Storage
 * stays the source: a snapshot is reparsed only when the stored text changes,
 * so it keeps its identity until then. A list storage refused (a full quota,
 * storage switched off) holds in memory until the page reloads.
 */
export const storedLists = (() => {
  const parsed = new Map<string, { raw: string | null; list: string[] }>();
  const unsaved = new Map<string, string[]>();
  const listeners = new Map<string, Set<() => void>>();

  function read(key: string): string[] {
    const held = unsaved.get(key);
    if (held) return held;
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null;
    }
    const cached = parsed.get(key);
    if (cached && cached.raw === raw) return cached.list;
    const list = storedList(key);
    parsed.set(key, { raw, list });
    return list;
  }

  return {
    read,
    /** Writes `next`, or what it makes of the latest list, and tells every reader of `key`. */
    write(key: string, next: string[] | ((current: string[]) => string[])) {
      const list = typeof next === 'function' ? next(read(key)) : next;
      if (rememberList(key, list)) unsaved.delete(key);
      else unsaved.set(key, list);
      for (const listener of listeners.get(key) ?? []) listener();
    },
    /** Calls `listener` when `key` changes, here or in another tab; returns the unsubscribe. */
    subscribe(key: string, listener: () => void): () => void {
      const forKey = listeners.get(key) ?? new Set();
      listeners.set(key, forKey);
      forKey.add(listener);
      const onStorage = (event: StorageEvent) => {
        // `key` is null when another tab cleared the whole storage.
        if (event.key === null || event.key === key) listener();
      };
      window.addEventListener('storage', onStorage);
      return () => {
        forKey.delete(listener);
        window.removeEventListener('storage', onStorage);
      };
    },
  };
})();

/** `list` with `id` on top (the latest first), or taken out: an id is listed once however often it is added. */
export function withListedFirst(list: readonly string[], id: string, listed: boolean): string[] {
  const rest = list.filter((listedId) => listedId !== id);
  return listed ? [id, ...rest] : rest;
}

/** `folded` with `key` folded, or opened: a fold is one entry however often it is made. */
export function withFold(folded: readonly string[], key: string, open: boolean): string[] {
  const rest = folded.filter((foldedKey) => foldedKey !== key);
  return open ? rest : [...rest, key];
}
