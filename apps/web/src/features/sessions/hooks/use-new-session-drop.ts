import { createContext, type RefObject, useContext, useEffect, useRef } from 'react';

type Receive = (files: File[]) => void;

/**
 * Where New session's pane hands a drop: the screen's `DropZone` wraps the
 * pane and calls the ref; the composer, which holds the task's files,
 * registers itself on it. The files stay in the composer and a keystroke
 * stays in the textarea: the ref's identity never changes, so nothing
 * re-renders through it.
 */
export const NewSessionDropContext = createContext<RefObject<Receive | null> | null>(null);

/** The screen's end: the ref its `DropZone` calls. */
export function useNewSessionDrop(): RefObject<Receive | null> {
  return useRef<Receive | null>(null);
}

/**
 * The composer's end: take the pane's drops while mounted. The outside
 * system is the screen's ref; registering after render keeps the write out
 * of render, where the React Compiler would refuse it.
 */
export function useReceiveDrops(receive: Receive) {
  const target = useContext(NewSessionDropContext);
  useEffect(() => {
    if (!target) return;
    target.current = receive;
    return () => {
      if (target.current === receive) target.current = null;
    };
  });
}
