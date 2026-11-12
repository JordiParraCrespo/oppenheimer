import { areThemesAttached, getHighlighterIfLoaded, preloadHighlighter } from '@pierre/diffs';
import { useEffect, useState } from 'react';

/** The two themes every diff is drawn in; the app's switch picks between them. */
export const DIFF_THEME = { light: 'pierre-light', dark: 'pierre-dark' } as const;

const loaded = () => getHighlighterIfLoaded() !== undefined && areThemesAttached(DIFF_THEME);

/**
 * Whether the diff library's highlighter is loaded with the diff's themes,
 * loading it when it is not. A diff mounted before then draws an empty shell
 * and fills it once the highlighter arrives; under React's development
 * double mount the second instance takes that shell for finished output and
 * never fills it, so `DiffView` waits for this before it mounts the diff.
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
    preloadHighlighter({ themes: Object.values(DIFF_THEME), langs: [] }).then(settle, settle);
    return () => {
      live = false;
    };
  }, [ready]);

  return ready;
}
