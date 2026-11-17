import { type useMoveTask, useMoveTasks } from '@oppenheimer/frontend-consumer/react';
import { useRef } from 'react';
import type { CardMove } from '../lib/card-selection';

/**
 * Moves several cards together (`useMoveTasks`): all land on the board at
 * once, the requests go one at a time, and the first refusal stops the rest
 * and puts back what it had not moved; `error` says why above the columns. A
 * lone move goes straight through the board's own move, as a drag of one card
 * always did. While a run is under way nothing else moves: a second run would
 * interleave with it, each placing cards under ones the other is carrying off.
 */
export function useBulkMove(move: ReturnType<typeof useMoveTask>) {
  const many = useMoveTasks();
  // Read and set in the same handler, before a render could report `moving`.
  const running = useRef(false);

  return {
    moving: many.isPending,
    error: many.error,
    reset: many.reset,
    run: (moves: readonly CardMove[]) => {
      const [first] = moves;
      if (!first || running.current) return;
      if (moves.length === 1) {
        move.mutate(first);
        return;
      }
      running.current = true;
      many.run(moves, () => {
        running.current = false;
      });
    },
  };
}
