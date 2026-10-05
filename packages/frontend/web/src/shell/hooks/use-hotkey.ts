import { useEffect, useRef } from 'react';

/**
 * Runs `handler` when a key combination is pressed anywhere in the document.
 *
 * The keystroke lands on whatever is focused, never on the component that
 * answers it, so the listener is a subscription to the document; the effect
 * lives here so components stay free of them.
 *
 * It subscribes once. `handler` and `matches` are read through a ref an effect
 * keeps current (a ref written during render makes the React Compiler skip the
 * hook), because callers pass an inline `() => setOpen(true)`, and depending
 * on it would rebind the document listener on every render of the shell.
 *
 * The default `matches` is ⌘K / Ctrl+K.
 */
export function useHotkey(
  handler: () => void,
  matches: (event: KeyboardEvent) => boolean = isCommandK,
): void {
  const latest = useRef({ handler, matches });
  useEffect(() => {
    latest.current = { handler, matches };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!latest.current.matches(event)) return;
      event.preventDefault();
      latest.current.handler();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}

function isCommandK(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
}
