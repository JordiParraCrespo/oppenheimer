import { createContext, useContext, useState } from 'react';
import { createFileHandOff, type FileHandOff } from '../lib/file-hand-off';
import { useTakeFiles } from './use-take-files';

/**
 * Where New session's pane hands a drop: the screen's `DropZone` wraps the
 * pane and calls `deliver`; the composer, which holds the task's files,
 * registers itself (`FileHandOff`).
 */
export const NewSessionDropContext = createContext<FileHandOff | null>(null);

/** The screen's end, made once for the screen's life. */
export function useNewSessionDrop(): FileHandOff {
  const [drop] = useState(createFileHandOff);
  return drop;
}

/** The composer's end: take the pane's drops while mounted. */
export function useReceiveDrops(receive: (files: File[]) => void) {
  useTakeFiles(useContext(NewSessionDropContext), receive);
}
