import { useState } from 'react';
import {
  backgroundFromFile,
  rememberBackground,
  storedBackground,
} from '../lib/new-session-background';

/** Why the last change did not take: the file, or the browser's storage. */
export type BackgroundFailure = 'unreadable' | 'unsaved';

/**
 * The image behind New session on this device, and the two ways to change
 * it: choose a file, or take it away. A file the browser cannot read as an
 * image leaves the current one in place (`unreadable`); a change the
 * browser will not keep (a full quota, private browsing) shows until the
 * page reloads (`unsaved`). The screen draws either until it is dismissed or
 * the next change works.
 */
export function useNewSessionBackground() {
  const [image, setImage] = useState<string | null>(storedBackground);
  const [failure, setFailure] = useState<BackgroundFailure | null>(null);

  const apply = (next: string | null) => {
    setImage(next);
    setFailure(rememberBackground(next) ? null : 'unsaved');
  };

  return {
    image,
    failure,
    dismiss: () => setFailure(null),
    choose: async (file: File) => {
      let next: string;
      try {
        next = await backgroundFromFile(file);
      } catch {
        setFailure('unreadable');
        return;
      }
      apply(next);
    },
    remove: () => apply(null),
  };
}
