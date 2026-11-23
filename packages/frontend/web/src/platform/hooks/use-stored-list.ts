import { type SetStateAction, useCallback, useSyncExternalStore } from 'react';
import { rememberList, storedList } from '../lib/stored-list';

/**
 * One list per key for the whole page, so every reader of a key sees a
 * change the moment any of them makes it, and a change another tab writes
 * arrives through the `storage` event. Storage stays the source: a snapshot
 * is reparsed only when the stored text changes. A list storage refused (a
 * full quota, storage switched off) holds in memory until the page reloads.
 */
const parsed = new Map<string, { raw: string | null; list: string[] }>();
const unsaved = new Map<string, string[]>();
const listeners = new Map<string, Set<() => void>>();

function current(key: string): string[] {
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

function notify(key: string) {
  for (const listener of listeners.get(key) ?? []) listener();
}

function write(key: string, action: SetStateAction<string[]>) {
  const next = typeof action === 'function' ? action(current(key)) : action;
  if (rememberList(key, next)) unsaved.delete(key);
  else unsaved.set(key, next);
  notify(key);
}

function subscribe(key: string, listener: () => void) {
  const forKey = listeners.get(key) ?? new Set();
  listeners.set(key, forKey);
  forKey.add(listener);
  const onStorage = (event: StorageEvent) => {
    // `key` is null when another tab cleared the whole storage.
    if (event.key !== null && event.key !== key) return;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    forKey.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** A list of ids kept in `key` on this device, shared by every reader of `key`. */
export function useStoredList(key: string) {
  const list = useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(key, listener), [key]),
    () => current(key),
  );
  const setList = useCallback((action: SetStateAction<string[]>) => write(key, action), [key]);

  return [list, setList] as const;
}
