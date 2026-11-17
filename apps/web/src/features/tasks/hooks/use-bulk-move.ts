import { type useMoveTask, usePlaceTasks } from '@oppenheimer/frontend-consumer/react';
import { useRef, useState } from 'react';
import type { CardMove } from '../lib/card-selection';

/**
 * Moves several cards through the board's own move, one at a time: each
 * places its card under the one moved before it. Every card lands on the
 * board at once (`usePlaceTasks`); only the requests wait for each other. The first refusal stops the
 * rest, and the move's `error` says why above the columns. A lone move goes
 * straight through, as a drag of one card always did. While a run is under
 * way nothing else moves: a second run would interleave with it, each placing
 * cards under ones the other is carrying off.
 */
export function useBulkMove(move: ReturnType<typeof useMoveTask>) {
  const [moving, setMoving] = useState(false);
  // Read and set in the same handler, before a render could report `moving`.
  const running = useRef(false);
  const place = usePlaceTasks();

  async function inOrder(moves: readonly CardMove[]) {
    for (const next of moves) await move.mutateAsync(next);
  }

  return {
    moving,
    run: (moves: readonly CardMove[]) => {
      const [first] = moves;
      if (!first || running.current) return;
      if (moves.length === 1) {
        move.mutate(first);
        return;
      }
      running.current = true;
      setMoving(true);
      place(moves);
      inOrder(moves)
        .catch(() => undefined)
        .finally(() => {
          running.current = false;
          setMoving(false);
        });
    },
  };
}
