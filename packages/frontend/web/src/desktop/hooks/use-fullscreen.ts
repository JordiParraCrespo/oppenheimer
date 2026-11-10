import { useEffect, useRef, useState } from 'react';

/**
 * Full screen for one element: the browser's own where it has it, and
 * otherwise the element pinned over the whole window (Safari on iOS, which
 * takes only video full screen). Escape leaves either.
 */
export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [native, setNative] = useState(false);
  const [pinned, setPinned] = useState(false);

  // The document's full-screen element, which Escape and the browser's own
  // controls change behind this hook's back.
  useEffect(() => {
    const sync = () =>
      setNative(ref.current !== null && document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  // Escape for the pinned form, which the browser knows nothing of.
  useEffect(() => {
    if (!pinned) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPinned(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinned]);

  const toggle = () => {
    const element = ref.current;
    if (!element) return;
    if (native) {
      void document.exitFullscreen();
      return;
    }
    if (pinned) {
      setPinned(false);
      return;
    }
    if (document.fullscreenEnabled && element.requestFullscreen) {
      element.requestFullscreen().catch(() => setPinned(true));
      return;
    }
    setPinned(true);
  };

  return { ref, active: native || pinned, pinned, toggle };
}
