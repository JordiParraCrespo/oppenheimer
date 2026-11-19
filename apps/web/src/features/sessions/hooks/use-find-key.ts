import { type RefObject, useEffect, useEffectEvent } from 'react';

/** ⌘ on a Mac, where Ctrl+F is the text field's own key (a character forward); Ctrl elsewhere. */
const IS_MAC = typeof navigator !== 'undefined' && /^Mac/.test(navigator.platform);

/**
 * Calls `onFind` for ⌘F on a Mac, Ctrl+F elsewhere, pressed with focus
 * inside `root`, in place of the browser's own find, which cannot see the
 * turns a long chat has not drawn.
 *
 * Effect: a `keydown` listener on the element.
 */
export function useFindKey(root: RefObject<HTMLElement | null>, onFind: () => void): void {
  const find = useEffectEvent(onFind);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || event.altKey || event.shiftKey) return;
      if (IS_MAC ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      find();
    };
    element.addEventListener('keydown', onKeyDown);
    return () => element.removeEventListener('keydown', onKeyDown);
  }, [root]);
}
