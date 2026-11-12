import { useEffect, useState } from 'react';

/** The two themes every diff is drawn in; the app's switch picks between them. */
export const DIFF_THEME = { light: 'pierre-light', dark: 'pierre-dark' } as const;

/** Set once the highlighter holds the themes, so a later diff mounts at once. */
let loaded = false;

async function loadHighlighter(): Promise<void> {
  const { preloadHighlighter } = await import('@pierre/diffs');
  await preloadHighlighter({ themes: Object.values(DIFF_THEME), langs: [] });
  loaded = true;
}

/**
 * Whether the diff library's highlighter is loaded with the diff's themes,
 * loading it when it is not. A diff mounted before then draws an empty shell
 * and fills it once the highlighter arrives; under React's development
 * double mount the second instance takes that shell for finished output and
 * never fills it, so `DiffView` waits for this before it mounts the diff.
 *
 * The library's root is imported when asked for: it is the only entry that
 * exports the loader, and it reaches code that does not belong in the chunk
 * of a screen that only might draw a diff.
 *
 * The outside system is the library's shared highlighter, loaded once per page.
 */
export function useDiffHighlighter(): boolean {
  const [ready, setReady] = useState(loaded);

  useEffect(() => {
    if (ready) return;
    let live = true;
    const settle = () => {
      if (live) setReady(true);
    };
    // A failed load still mounts the diff, which then reports it its own way.
    loadHighlighter().then(settle, settle);
    return () => {
      live = false;
    };
  }, [ready]);

  return ready;
}
