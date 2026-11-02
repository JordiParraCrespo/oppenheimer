import { useEffect } from 'react';

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * The row menu's keys for the item in the pane, as the frame draws them: E
 * marks it done, L deprioritizes it (or restores it). Not while the reader is
 * typing, and not with a modifier, so ⌘L and the browser keep theirs. Syncs
 * with the document's key events; `null` listens for nothing.
 */
export function useInboxKeys(handlers: { onDone: () => void; onLow: () => void } | null): void {
  useEffect(() => {
    if (!handlers) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || typing(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === 'e') handlers.onDone();
      else if (key === 'l') handlers.onLow();
      else return;
      event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
