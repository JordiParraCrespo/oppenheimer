import { useState } from 'react';
import {
  backgroundFromFile,
  rememberBackground,
  storedBackground,
} from '../lib/new-session-background';

/**
 * The image behind New session on this device, and the two ways to change
 * it: choose a file, or take it away. A file the browser cannot read as an
 * image leaves the current one in place and sets `unreadable`, which the
 * screen draws until it is dismissed or the next pick works.
 */
export function useNewSessionBackground() {
  const [image, setImage] = useState<string | null>(storedBackground);
  const [unreadable, setUnreadable] = useState(false);

  return {
    image,
    unreadable,
    dismiss: () => setUnreadable(false),
    choose: async (file: File) => {
      try {
        const next = await backgroundFromFile(file);
        rememberBackground(next);
        setImage(next);
        setUnreadable(false);
      } catch {
        setUnreadable(true);
      }
    },
    remove: () => {
      rememberBackground(null);
      setImage(null);
      setUnreadable(false);
    },
  };
}
