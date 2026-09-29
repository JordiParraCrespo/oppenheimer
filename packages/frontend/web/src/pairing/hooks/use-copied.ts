import { useEffect, useRef, useState } from 'react';

/** How long a button reads "Copied" before it reads its verb again. */
const COPIED_FOR_MS = 1800;

/**
 * Which of several things was copied last, for a row of copy buttons that
 * each read "Copied" for a moment. `copy(key, text)` writes the clipboard
 * and marks `key`; the mark clears itself.
 *
 * The timer is the one effect: it synchronises with the clipboard's moment,
 * and is cleared on unmount so a dialog closed mid-flash sets no state.
 */
export function useCopied<Key extends string>() {
  const [copied, setCopied] = useState<Key | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The timeout is a thing outside React; clearing it is what unmount owes it.
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy(key: Key, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), COPIED_FOR_MS);
    } catch {
      // Clipboard denied: the text is still readable in the Inspect fold.
    }
  }

  return { copied, copy };
}
