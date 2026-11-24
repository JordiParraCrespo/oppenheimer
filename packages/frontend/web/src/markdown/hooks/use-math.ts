import { useEffect, useSyncExternalStore } from 'react';

type Typeset = (tex: string, display: boolean) => string | null;

let loaded: Typeset | null = null;
let loading = false;
const listeners = new Set<() => void>();

function load(): void {
  if (loading) return;
  loading = true;
  import('../lib/math').then(
    ({ typeset }) => {
      loaded = typeset;
      for (const listener of listeners) listener();
    },
    () => {
      // A chunk that failed to load is tried again by the next formula.
      loading = false;
    },
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * KaTeX's typesetter once it has loaded, `null` before: a formula shows its
 * TeX until then. Every formula on the page shares one load.
 */
export function useMath(): Typeset | null {
  const typeset = useSyncExternalStore(
    subscribe,
    () => loaded,
    () => null,
  );
  // KaTeX, a library outside React, is fetched on the first formula drawn.
  useEffect(() => {
    if (!loaded) load();
  }, []);
  return typeset;
}
