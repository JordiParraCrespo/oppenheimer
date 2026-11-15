import { type RefObject, useEffect, useEffectEvent } from 'react';

/** A popup the Escape belongs to: a dialog, a menu or a list open over the chat. */
const POPUP = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/** Whether a key press lands in a field someone writes in: a search box, a name being edited. */
function inField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * Escape stops the bot's turn under way, as the composer's Stop does, the
 * way Claude Code and Codex take it: from the composer's field or from
 * anywhere that is not a field. Off while there is no turn (`onStop` null).
 * The key is left alone when something took it first (the `/` menu), when
 * it lands in another field (the sidebar's search clears on Escape), and
 * while a dialog, menu or list is open, since there Escape closes it.
 */
export function useEscapeToStop(
  composer: RefObject<HTMLTextAreaElement | null>,
  onStop: (() => void) | null,
): void {
  const press = useEffectEvent((event: KeyboardEvent) => {
    if (!onStop || event.key !== 'Escape' || event.defaultPrevented || event.repeat) return;
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target !== composer.current && inField(event.target)) return;
    if (document.querySelector(POPUP)) return;
    event.preventDefault();
    onStop();
  });

  const enabled = onStop !== null;
  // Listens to the window's key presses, a DOM event outside React, while a turn is under way.
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => press(event);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
