import { useEffect } from 'react';
import type { FileHandOff } from '../lib/file-hand-off';

/**
 * A composer's end of a `FileHandOff`: take the files its pane catches while
 * mounted. The outside system is the pane's drop target and paste listener,
 * registered after render. No hand-off, nothing to take.
 */
export function useTakeFiles(
  handOff: FileHandOff | null | undefined,
  receive: (files: File[]) => void,
) {
  useEffect(() => handOff?.register(receive));
}
