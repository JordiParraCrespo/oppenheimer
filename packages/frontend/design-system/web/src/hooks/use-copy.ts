import { useEffect, useRef, useState } from 'react';

/** How long a copy control says "Copied" before it reads "Copy" again. */
const COPIED_FOR_MS = 1600;

/**
 * Copy `text` to the clipboard and report it for a moment: `copied` is true
 * for 1.6s after a successful `copy()`, so the control can swap its label and
 * icon. Every copy control in the package uses this one, so they all hold
 * "Copied" for the same time.
 *
 * A denied clipboard leaves `copied` false and throws nothing: the text is
 * still on screen to select.
 *
 * The outside system is the timer that resets the flag.
 */
export function useCopy(text: string): { copied: boolean; copy: () => Promise<void> } {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_FOR_MS);
  }

  return { copied, copy };
}
