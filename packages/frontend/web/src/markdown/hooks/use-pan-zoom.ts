import { type MouseEvent, type PointerEvent, useRef, useState, type WheelEvent } from 'react';

const MIN = 1;
const MAX = 6;
const STEP = 1.4;

type View = { scale: number; x: number; y: number };
const FIT: View = { scale: 1, x: 0, y: 0 };

/**
 * A picture fitted to its stage, then zoomed (the wheel, the buttons, a
 * double press) toward the pointer and dragged around. Zoom never goes
 * below the fit, and coming back to the fit centres it again.
 */
export function usePanZoom() {
  const [view, setView] = useState<View>(FIT);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  const zoomTo = (scale: number, toward?: { x: number; y: number }) => {
    setView((current) => {
      const next = Math.min(MAX, Math.max(MIN, scale));
      if (next === MIN) return FIT;
      const point = toward ?? { x: 0, y: 0 };
      const ratio = next / current.scale;
      return {
        scale: next,
        x: point.x - (point.x - current.x) * ratio,
        y: point.y - (point.y - current.y) * ratio,
      };
    });
  };

  /** Where the pointer is, from the stage's centre (the picture's origin). */
  const fromCentre = (event: { clientX: number; clientY: number; currentTarget: Element }) => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - (box.left + box.width / 2),
      y: event.clientY - (box.top + box.height / 2),
    };
  };

  return {
    view,
    zoomed: view.scale > MIN,
    zoomIn: () => zoomTo(view.scale * STEP),
    zoomOut: () => zoomTo(view.scale / STEP),
    fit: () => setView(FIT),
    stage: {
      onWheel: (event: WheelEvent<HTMLElement>) => {
        const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0025));
        zoomTo(view.scale * factor, fromCentre(event));
      },
      onDoubleClick: (event: MouseEvent<HTMLElement>) => {
        if (view.scale > MIN) setView(FIT);
        else zoomTo(2, fromCentre(event));
      },
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (view.scale <= MIN || event.button !== 0) return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const from = drag.current;
        if (!from || from.id !== event.pointerId) return;
        drag.current = { id: from.id, x: event.clientX, y: event.clientY };
        setView((current) => ({
          ...current,
          x: current.x + event.clientX - from.x,
          y: current.y + event.clientY - from.y,
        }));
      },
      onPointerUp: () => {
        drag.current = null;
      },
      onPointerCancel: () => {
        drag.current = null;
      },
    },
  };
}
