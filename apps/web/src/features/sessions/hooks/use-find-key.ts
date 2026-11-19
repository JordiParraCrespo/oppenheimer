import { type RefObject, useEffect, useEffectEvent } from 'react';

/**
 * Calls `onFind` for Ctrl+F (⌘F on a Mac) pressed with focus inside `root`,
 * in place of the browser's own find, which cannot see the turns a long
 * chat has not drawn.
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
      if (!(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      find();
    };
    element.addEventListener('keydown', onKeyDown);
    return () => element.removeEventListener('keydown', onKeyDown);
  }, [root]);
}
