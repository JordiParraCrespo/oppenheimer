import type { useMoveTask } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import type { CardMove } from '../lib/card-selection';

/**
 * Moves several cards through the board's own move, one at a time: each
 * places its card under the one moved before it. The first refusal stops the
 * rest, and the move's `error` says why above the columns. A lone move goes
 * straight through, as a drag of one card always did.
 */
export function useBulkMove(move: ReturnType<typeof useMoveTask>) {
  const [moving, setMoving] = useState(false);

  async function inOrder(moves: readonly CardMove[]) {
    for (const next of moves) await move.mutateAsync(next);
  }

  return {
    moving,
    run: (moves: readonly CardMove[]) => {
      const [first] = moves;
      if (!first) return;
      if (moves.length === 1) {
        move.mutate(first);
        return;
      }
      setMoving(true);
      inOrder(moves)
        .catch(() => undefined)
        .finally(() => setMoving(false));
    },
  };
}
