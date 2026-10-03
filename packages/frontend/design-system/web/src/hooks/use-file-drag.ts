import { type RefObject, useEffect, useRef, useState } from 'react';

type FileDragOptions = {
  /** Called once per drop with the dropped files, in the order given. */
  onFiles: (files: File[]) => void;
  /** Stops listening (and clears the state) while true. */
  disabled?: boolean;
};

/**
 * Whether files are being dragged over `target` (an element, or the whole
 * `window`), and the files when they land.
 *
 * Only a drag that carries files counts: dragging a link or selected text
 * past the zone leaves it alone and keeps its default. While one does,
 * `dragover` is cancelled, so dropping attaches the file instead of the
 * browser opening it in the tab.
 *
 * `dragenter` and `dragleave` fire on every child the pointer crosses, so the
 * hook counts them rather than trusting the last one; a drop or a
 * cancelled drag (`dragend`, or the pointer leaving the window) resets the
 * count, so the overlay never sticks.
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
    const node: HTMLElement | Window | null = target === 'window' ? window : target.current;
    if (!node) return;

    let depth = 0;
    const reset = () => {
      depth = 0;
      setDragging(false);
    };
    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const over = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      reset();
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) latest.current(files);
    };

    const on = node.addEventListener.bind(node) as (
      type: string,
      fn: (event: DragEvent) => void,
    ) => void;
    const off = node.removeEventListener.bind(node) as (
      type: string,
      fn: (event: DragEvent) => void,
    ) => void;
    on('dragenter', enter);
    on('dragover', over);
    on('dragleave', leave);
    on('drop', drop);
    window.addEventListener('dragend', reset);
    return () => {
      off('dragenter', enter);
      off('dragover', over);
      off('dragleave', leave);
      off('drop', drop);
      window.removeEventListener('dragend', reset);
    };
  }, [target, disabled]);

  return dragging;
}

function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}
