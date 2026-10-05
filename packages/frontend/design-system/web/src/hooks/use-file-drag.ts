import { type RefObject, useEffect, useRef, useState } from 'react';

type FileDragOptions = {
  /** Called once per drop with the dropped files, in the order given. */
  onFiles: (files: File[]) => void;
  /** Stops listening (and clears the state) while true. */
  disabled?: boolean;
};

/**
 * How long after the last sign of a drag (an enter, or the steady stream of
 * `dragover`s the browser sends while the pointer is over the target) the
 * drag counts as gone. `dragleave` alone cannot say so: it fires for every
 * child the pointer crosses, and some browsers leave its `relatedTarget`
 * empty, so it only starts this clock.
 */
const LEAVE_AFTER_MS = 80;

/**
 * Whether files are being dragged over `target` (an element, or the whole
 * `window`), and the files when they land.
 *
 * Only a drag that carries files starts it: dragging a link or selected text
 * past the target leaves it alone and keeps its default. `types` is read on
 * the way in (`dragenter`, `dragover`), never on `dragleave`, where several
 * browsers report it empty. While a file drag is over the target `dragover`
 * is cancelled, so dropping attaches the file instead of the browser opening
 * it in the tab.
 *
 * The state changes only on its edges (a drag arriving, a drag gone), so the
 * caller re-renders twice per drag, not once per child the pointer crosses.
 *
 * The outside system is the DOM's drag events on the target.
 */
export function useFileDrag(
  target: RefObject<HTMLElement | null> | 'window',
  { onFiles, disabled = false }: FileDragOptions,
): boolean {
  const [dragging, setDragging] = useState(false);
  const latest = useRef(onFiles);
  // Written after render, not during it: a ref write in render is one of
  // the things the React Compiler silently refuses to compile.
  useEffect(() => {
    latest.current = onFiles;
  });

  useEffect(() => {
    if (disabled) {
      setDragging(false);
      return;
    }
    const node: EventTarget | null = target === 'window' ? window : target.current;
    if (!node) return;

    let over = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = () => {
      clearTimeout(timer);
      if (over) return;
      over = true;
      setDragging(true);
    };
    const hide = () => {
      clearTimeout(timer);
      if (!over) return;
      over = false;
      setDragging(false);
    };

    const stop: Array<() => void> = [
      listen(node, 'dragenter', (event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        show();
      }),
      listen(node, 'dragover', (event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        show();
      }),
      listen(node, 'dragleave', (event) => {
        if (!over) return;
        // Still inside: the pointer only crossed onto a child.
        const into = event.relatedTarget;
        if (into instanceof Node && node instanceof Node && node.contains(into)) return;
        clearTimeout(timer);
        timer = setTimeout(hide, LEAVE_AFTER_MS);
      }),
      listen(node, 'drop', (event) => {
        if (!over && !carriesFiles(event)) return;
        event.preventDefault();
        hide();
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length > 0) latest.current(files);
      }),
      // A drag cancelled with Escape, or dropped somewhere else.
      listen(window, 'dragend', hide),
    ];
    return () => {
      clearTimeout(timer);
      for (const off of stop) off();
    };
  }, [target, disabled]);

  return dragging;
}

/** One typed drag listener on a window or an element; returns its removal. */
function listen(
  node: EventTarget,
  type: 'dragenter' | 'dragover' | 'dragleave' | 'drop' | 'dragend',
  handler: (event: DragEvent) => void,
  options?: AddEventListenerOptions,
): () => void {
  const fn = (event: Event) => {
    if (event instanceof DragEvent) handler(event);
  };
  node.addEventListener(type, fn, options);
  return () => node.removeEventListener(type, fn, options);
}

function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}
