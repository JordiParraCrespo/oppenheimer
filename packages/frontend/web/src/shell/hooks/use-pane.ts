import { createContext, useContext, useEffect } from 'react';

type FileHandler = (files: File[]) => void;

/** Where a screen's bar goes: the slot the shell keeps above the page frame. */
export const PaneBarContext = createContext<HTMLElement | null>(null);

/**
 * The pane's drop target, one object for the shell's life: the handler of the
 * screen that takes files now, and the switch that turns the pane's listener
 * on while one does.
 */
export interface PaneDrop {
  setFiles: (onFiles: FileHandler | null) => void;
  setTakesFiles: (on: boolean) => void;
}

export const PaneDropContext = createContext<PaneDrop | null>(null);

export function usePaneBar(): HTMLElement | null {
  return useContext(PaneBarContext);
}

/**
 * Hands files dropped anywhere on the window to `onFiles`, with the pane
 * drawing the outline on its own edge while they are dragged: a screen inside
 * a page the shell frames takes drops without drawing or positioning anything.
 * One screen at a time; it lets go when it unmounts.
 *
 * The outside system is the shell's pane, which owns the listener and the
 * outline.
 */
export function usePaneDrop(onFiles: FileHandler): void {
  const pane = useContext(PaneDropContext);
  useEffect(() => {
    pane?.setFiles(onFiles);
  });
  useEffect(() => {
    if (!pane) return;
    pane.setTakesFiles(true);
    return () => {
      pane.setTakesFiles(false);
      pane.setFiles(null);
    };
  }, [pane]);
}
