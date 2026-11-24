import { useEffect } from 'react';

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Where the arrows already move focus (a question's options, a toolbar, a menu). */
const ARROWS_TAKEN =
  '[role=group],[role=toolbar],[role=menu],[role=listbox],[role=radiogroup],[role=tablist]';

function arrowsTaken(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(ARROWS_TAKEN) !== null;
}

export interface InboxKeyHandlers {
  /** E: Done, where the card can be put away. */
  onDone: () => void;
  /** J or →: the next item. */
  onNext: () => void;
  /** K or ←: the one before. */
  onPrevious: () => void;
  /** 1 to 9: the card's answer of that number; true when there was one to press. */
  onAnswer: (n: number) => boolean;
}

/**
 * The deck's keys, for the item in hand, as the dock and the answers wear
 * them: E is Done, J / → and K / ← move to the next and previous item, and
 * 1–9 press the card's answer with that number.
 * Not while the reader is typing, not with a modifier, so ⌘L and the
 * browser keep theirs, and not the arrows where they already move focus. Syncs with the document's key events; `null` listens
 * for nothing.
 */
export function useInboxKeys(handlers: InboxKeyHandlers | null): void {
  useEffect(() => {
    if (!handlers) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || typing(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const key = event.key.toLowerCase();
      if (key.startsWith('arrow') && arrowsTaken(event.target)) return;
      if (key === 'e') handlers.onDone();
      else if (key === 'j' || key === 'arrowright') handlers.onNext();
      else if (key === 'k' || key === 'arrowleft') handlers.onPrevious();
      else if (/^[1-9]$/.test(key)) {
        if (!handlers.onAnswer(Number(key))) return;
      } else return;
      event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
