import { useEffect } from 'react';

/** `N` opens the next pull request to review: a keydown listener on the document, off while typing. */
export function useReviewNextShortcut(onNext: (() => void) | undefined) {
  useEffect(() => {
    if (!onNext) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      onNext();
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [onNext]);
}
