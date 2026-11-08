import { useSyncExternalStore } from 'react';
import type { StoredTexts } from '../lib/stored-text';

/** The text `texts` keeps for `id`; re-renders when it changes, whoever wrote it. */
export function useStoredText(texts: StoredTexts, id: string): string {
  return useSyncExternalStore(
    (onChange) => texts.subscribe((changed) => changed === id && onChange()),
    () => texts.read(id),
  );
}
