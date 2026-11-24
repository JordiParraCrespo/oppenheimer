import { useSaveColumnOrder } from '@oppenheimer/frontend-consumer/tasks';
import { useState } from 'react';

/**
 * The board's column order while the person drags: shown at once, saved in
 * the background, and replaced by what the server answers so the board shows
 * what was stored.
 */
export function useColumnOrder(projectId: string, initial: string[]) {
  const [order, setOrder] = useState(initial);
  const save = useSaveColumnOrder(projectId);

  const move = (next: string[]) => {
    setOrder(next);
    save.mutate({ columnIds: next }, { onSuccess: (stored) => setOrder(stored.columnIds) });
  };

  return { order, move };
}
