import { useEffect } from 'react';

/**
 * The queue's keys on the document: `j` / `k` or the arrows move through the
 * rows, Enter opens the one picked, `/` goes to the search and Esc lets go.
 * Off while typing, except Esc, which the search field keeps for itself.
 */
export function useQueueKeys(keys: {
  onMove: (step: 1 | -1) => void;
  onOpen: () => void;
  onSearch: () => void;
  onRelease: () => void;
}) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))
        return;
      const act = {
        j: () => keys.onMove(1),
        ArrowDown: () => keys.onMove(1),
        k: () => keys.onMove(-1),
        ArrowUp: () => keys.onMove(-1),
        Enter: keys.onOpen,
        '/': keys.onSearch,
        Escape: keys.onRelease,
      }[event.key];
      if (!act) return;
      // Enter on a focused control is that control's own, not the queue's.
      if (event.key === 'Enter' && target?.closest('button, a, [role="menuitem"]')) return;
      event.preventDefault();
      act();
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [keys]);
}
