import { useEffect } from 'react';

/**
 * The deck's keys on the document: → says yes to the card, ← passes it, Enter
 * opens its changes, `c` writes a comment, `m` approves and merges, Esc lets
 * go of what is armed. Off while typing and inside a dialog; a key whose
 * action is absent is left alone.
 */
export function useReviewDeckKeys(keys: {
  onYes?: () => void;
  onPass?: () => void;
  onOpen?: () => void;
  onComment?: () => void;
  onMerge?: () => void;
  onRelease?: () => void;
}) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      // A held key repeats: without this, holding → would arm a merge and then make it,
      // card after card.
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))
        return;
      const act = {
        ArrowRight: keys.onYes,
        ArrowLeft: keys.onPass,
        Enter: keys.onOpen,
        c: keys.onComment,
        m: keys.onMerge,
        Escape: keys.onRelease,
      }[event.key];
      if (!act) return;
      // Enter on a focused control is that control's own, not the deck's.
      if (event.key === 'Enter' && target?.closest('button, a, [role="menuitem"]')) return;
      event.preventDefault();
      act();
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [keys]);
}
