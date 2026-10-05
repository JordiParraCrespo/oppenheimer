import { createContext, useContext, useEffect, useState } from 'react';

type Receive = (files: File[]) => void;

/** The pane's end calls `deliver`; the composer's end `register`s itself. */
type NewSessionDrop = {
  deliver: Receive;
  /** Take the pane's drops; returns the function that stops. */
  register: (receive: Receive) => () => void;
};

/**
 * Where New session's pane hands a drop: the screen's `DropZone` wraps the
 * pane and calls `deliver`; the composer, which holds the task's files,
 * registers itself. The files stay in the composer and a keystroke stays in
 * the textarea: the object is made once, so nothing re-renders through it.
 */
export const NewSessionDropContext = createContext<NewSessionDrop | null>(null);

/** The screen's end, made once for the screen's life. */
export function useNewSessionDrop(): NewSessionDrop {
  const [drop] = useState<NewSessionDrop>(() => {
    let current: Receive | null = null;
    return {
      deliver: (files) => current?.(files),
      register: (receive) => {
        current = receive;
        return () => {
          if (current === receive) current = null;
        };
      },
    };
  });
  return drop;
}

/**
 * The composer's end: take the pane's drops while mounted. The outside
 * system is the screen's drop target, registered after render.
 */
export function useReceiveDrops(receive: Receive) {
  const drop = useContext(NewSessionDropContext);
  useEffect(() => drop?.register(receive));
}
