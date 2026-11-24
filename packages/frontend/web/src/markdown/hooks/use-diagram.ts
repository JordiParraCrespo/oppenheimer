import { type RefObject, useEffect, useState, useSyncExternalStore } from 'react';
import type { DrawnDiagram } from '../lib/diagram';
import { type DiagramTheme, diagramTheme, themeKey } from '../lib/diagram-theme';

/**
 * What a diagram shows while it is drawn: `pending` until Mermaid answers,
 * then the picture, or `failed` when the source does not parse.
 */
export type DiagramState =
  | { status: 'pending' }
  | { status: 'drawn'; diagram: DrawnDiagram }
  | { status: 'failed' };

/** Each source drawn under each theme, so a diagram that remounts (a list scrolled back) never redraws. */
const drawnUnder = new Map<string, Promise<DrawnDiagram | null>>();
/** The last picture of each source, whatever its theme: what a remount shows before its first look at the theme. */
const lastDrawn = new Map<string, DiagramState>();
const CACHE_LIMIT = 64;

function remember<K, V>(map: Map<K, V>, key: K, value: V): void {
  map.delete(key);
  map.set(key, value);
  if (map.size > CACHE_LIMIT) map.delete(map.keys().next().value as K);
}

/** Mermaid, fetched with the first diagram, draws `source`. */
function drawLazily(source: string, theme: DiagramTheme): Promise<DrawnDiagram | null> {
  return import('../lib/diagram').then(({ drawDiagram }) => drawDiagram(source, theme));
}

// The page's theme: the class and attributes the theme owner writes on the
// root, and the system's own scheme for a page that follows it.
let themeEpoch = 0;
function subscribeTheme(onChange: () => void): () => void {
  const bump = () => {
    themeEpoch += 1;
    onChange();
  };
  const observer = new MutationObserver(bump);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'style'],
  });
  const scheme = window.matchMedia?.('(prefers-color-scheme: dark)');
  scheme?.addEventListener('change', bump);
  return () => {
    observer.disconnect();
    scheme?.removeEventListener('change', bump);
  };
}

/**
 * `source` drawn as a diagram in the colours around `frame`, redrawn when
 * the theme changes; Mermaid is loaded on the first call. The picture on
 * screen stays while the next theme's is drawn, so a switch never blinks.
 */
export function useDiagram(source: string, frame: RefObject<HTMLElement | null>): DiagramState {
  const epoch = useSyncExternalStore(
    subscribeTheme,
    () => themeEpoch,
    () => 0,
  );
  const [state, setState] = useState<{ source: string; state: DiagramState }>(() => ({
    source,
    state: lastDrawn.get(source) ?? { status: 'pending' },
  }));
  // Mermaid, an imperative library outside React, draws into a picture.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    // The epoch is read so a theme change draws again.
    void epoch;
    let live = true;
    const theme = diagramTheme(element);
    const key = `${themeKey(theme)}\n${source}`;
    let drawing = drawnUnder.get(key);
    if (!drawing) {
      drawing = drawLazily(source, theme);
      remember(drawnUnder, key, drawing);
    }
    drawing.then(
      (diagram) => {
        const next: DiagramState = diagram ? { status: 'drawn', diagram } : { status: 'failed' };
        remember(lastDrawn, source, next);
        if (live) setState({ source, state: next });
      },
      () => {
        drawnUnder.delete(key);
        if (live) setState({ source, state: { status: 'failed' } });
      },
    );
    return () => {
      live = false;
    };
  }, [source, frame, epoch]);
  return state.source === source ? state.state : (lastDrawn.get(source) ?? { status: 'pending' });
}
