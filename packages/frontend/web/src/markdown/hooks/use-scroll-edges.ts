import { useEffect, useRef, useState } from 'react';

/**
 * Whether a box that scrolls sideways has more to show before or after
 * what is in view, so its edges can fade where there is more.
 */
export function useScrollEdges<T extends HTMLElement>(content: unknown) {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ before: false, after: false });
  // The laid-out box: its scroll position and its size against its content's.
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    void content;
    const measure = () => {
      const before = box.scrollLeft > 1;
      const after = box.scrollLeft + box.clientWidth < box.scrollWidth - 1;
      setEdges((current) =>
        current.before === before && current.after === after ? current : { before, after },
      );
    };
    measure();
    box.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(box);
    for (const child of box.children) observer?.observe(child);
    return () => {
      box.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [content]);
  return { ref, ...edges };
}
