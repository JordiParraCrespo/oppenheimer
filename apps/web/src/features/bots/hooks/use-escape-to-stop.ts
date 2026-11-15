import { useEffect, useEffectEvent } from 'react';

/** A popup the Escape belongs to: a dialog, a menu or a list open over the chat. */
const POPUP = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/**
 * Escape stops the bot's turn under way, as the composer's Stop does, the
 * way Claude Code and Codex take it: anywhere in the chat, the field
 * included. Off while there is no turn (`enabled` false). The key is left
 * alone when something took it first (the `/` menu, a field that clears on
 * Escape) or a dialog, menu or list is open, since there Escape closes it.
 */
export function useEscapeToStop(enabled: boolean, onStop: () => void): void {
  const press = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.repeat) return;
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    if (document.querySelector(POPUP)) return;
    event.preventDefault();
    onStop();
  });

  // Listens to the window's key presses, a DOM event outside React, while a turn is under way.
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => press(event);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
