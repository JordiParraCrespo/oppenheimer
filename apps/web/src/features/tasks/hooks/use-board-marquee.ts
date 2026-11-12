import { type PointerEvent, useEffect, useRef, useState } from 'react';
import {
  type Box,
  MARQUEE_THRESHOLD,
  marqueeBox,
  marqueePick,
  OWNS_PRESS,
} from '../lib/card-selection';

/** A card is dragged from, never marqueed from; the selection bar is its own. */
const NOT_EMPTY = `[data-task-id], [data-slot="task-selection-bar"], ${OWNS_PRESS}`;

/**
 * Drag-to-pick on the board, as in a file manager: a mouse press on the
 * board's empty space (a tray, a gap, under the cards) and a drag draw a
 * rectangle, and every card it touches is picked as it goes. ⌘, Ctrl or Shift
 * held at the press adds to what is picked; otherwise the drag starts over.
 * A press that does not move clears the selection. Cards are found by their
 * `data-task-id` under the element that takes `onPointerDown`, and hit only
 * where the board's scroller shows them (`[data-slot="task-board"]`). Touch keeps
 * scrolling the board, so only a mouse draws.
 */
export function useBoardMarquee({
  picked,
  onPick,
  onClear,
}: {
  picked: readonly string[];
  onPick: (ids: string[]) => void;
  onClear: () => void;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const drag = useRef<AbortController | null>(null);

  // The window's pointer listeners: a drag still running when the board unmounts lets go.
  useEffect(() => () => drag.current?.abort(), []);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || event.pointerType !== 'mouse') return;
    const container = event.currentTarget;
    // A dialog the board opens is portaled away but still bubbles here in React.
    if (!container.contains(event.target as Node)) return;
    if ((event.target as Element).closest(NOT_EMPTY)) return;
    drag.current?.abort();
    const controller = new AbortController();
    drag.current = controller;
    const from = { x: event.clientX, y: event.clientY };
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const kept = additive ? [...picked] : [];
    let drawing = false;

    const onMove = (move: globalThis.PointerEvent) => {
      const to = { x: move.clientX, y: move.clientY };
      if (!drawing && Math.hypot(to.x - from.x, to.y - from.y) < MARQUEE_THRESHOLD) return;
      drawing = true;
      const next = marqueeBox(from, to);
      const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-task-id]'), (el) => ({
        id: el.dataset.taskId ?? '',
        box: el.getBoundingClientRect(),
      }));
      const board = container.querySelector('[data-slot="task-board"]');
      setBox(next);
      onPick(marqueePick(next, cards, kept, (board ?? container).getBoundingClientRect()));
    };
    const onEnd = () => {
      controller.abort();
      setBox(null);
      if (!drawing && !additive) onClear();
    };
    const options = { signal: controller.signal };
    // The drag picks cards; it does not select the text it crosses.
    window.addEventListener('selectstart', (start) => start.preventDefault(), options);
    window.addEventListener('pointermove', onMove, options);
    window.addEventListener('pointerup', onEnd, options);
    window.addEventListener('pointercancel', onEnd, options);
  };

  return { box, onPointerDown };
}
