import { useEffect } from 'react';

/**
 * `n` opens New task, outside a field (`18-plan-product.md` §1). Syncs with the
 * document's keyboard: a key pressed anywhere on the board, not in one control.
 */
export function useNewTaskShortcut(onNew: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))
        return;
      event.preventDefault();
      onNew();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onNew]);
}
