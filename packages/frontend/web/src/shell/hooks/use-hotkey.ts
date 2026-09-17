import { useEffect, useRef } from 'react';

/**
 * Runs `handler` when a key combination is pressed anywhere in the document.
 *
 * A global shortcut is one of the few things a component cannot express as
 * markup: the keystroke lands on whatever is focused, or on `body`, never on
 * the component that answers it. So the listener is a subscription to the
 * document, which is the one job `useEffect` is for — this hook is where that
 * effect lives, so components stay free of them.
 *
 * The subscription is made once. `handler` and `matches` are read through a
 * ref the render keeps current, because a caller passes an inline
 * `() => setOpen(true)` — a new function every render — and an effect that
 * depended on it would tear the document listener down and put it back on
 * every render of the shell. The effect's job is "a document keydown listener
 * exists", not "rebind whenever the parent rerenders".
 *
 * The default `matches` is ⌘K / Ctrl+K.
 */
export function useHotkey(
  handler: () => void,
  matches: (event: KeyboardEvent) => boolean = isCommandK,
): void {
  const latest = useRef({ handler, matches });
  latest.current = { handler, matches };

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
