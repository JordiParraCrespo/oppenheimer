import { useSyncExternalStore } from 'react';
import {
  rememberHiddenAccounts,
  storedHiddenAccounts,
  toggleHiddenAccount,
} from '../lib/google-accounts';

/**
 * The Google accounts this viewer switched off, shared by the sidebar that
 * toggles them and the month that leaves them out. One store for the page,
 * read from localStorage once and written back on every toggle.
 */
let hidden: readonly string[] | null = null;
const listeners = new Set<() => void>();

function snapshot(): readonly string[] {
  hidden ??= storedHiddenAccounts();
  return hidden;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function toggle(id: string) {
  hidden = toggleHiddenAccount(snapshot(), id);
  rememberHiddenAccounts(hidden);
  for (const listener of listeners) listener();
}

const NONE: readonly string[] = [];

export function useHiddenAccounts() {
  // localStorage, through a store the toggles notify.
  const ids = useSyncExternalStore(subscribe, snapshot, () => NONE);
  return { hidden: ids, toggle };
}
