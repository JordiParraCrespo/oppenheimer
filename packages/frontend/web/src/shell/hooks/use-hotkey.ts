import { useEffect } from 'react';

/**
 * Runs `handler` when a key combination is pressed anywhere in the document.
 *
 * A global shortcut is one of the few things a component cannot express as
 * markup: the keystroke lands on whatever is focused, or on `body`, never on
 * the component that answers it. So the listener is a subscription to the
 * document, which is the one job `useEffect` is for — this hook is where that
 * effect lives, so components stay free of them.
 *
 * The default `matches` is ⌘K / Ctrl+K.
 */
export function useHotkey(
  handler: () => void,
  matches: (event: KeyboardEvent) => boolean = isCommandK,
): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matches(event)) return;
      event.preventDefault();
      handler();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handler, matches]);
}

function isCommandK(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
}
