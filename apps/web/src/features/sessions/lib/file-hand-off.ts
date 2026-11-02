/** Where files go once a pane has caught them. */
type Receive = (files: File[]) => void;

/**
 * Files a pane catches (a drop on its edge, a paste anywhere on it) handed to
 * the composer that holds a message's files: the pane calls `deliver`, the
 * composer `register`s itself. The files stay in the composer and a
 * keystroke stays in its field: the object is made once, so nothing
 * re-renders through it. While no composer is registered, a delivery is
 * dropped.
 */
export interface FileHandOff {
  deliver: Receive;
  /** Take the pane's files; returns the function that stops. */
  register: (receive: Receive) => () => void;
}

export function createFileHandOff(): FileHandOff {
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
}
