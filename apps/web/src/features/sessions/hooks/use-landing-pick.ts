import { useEffect, useRef } from 'react';

/**
 * Apply the project New session lands on, once, when nothing named one.
 * `initialDraft` restores the remembered project but deliberately not its
 * scope, so once the lists can answer, that project is picked as the chip
 * would pick it. It decides once, at arrival: a project named by the address
 * or the dialog is `useSearchPick`'s, and nothing after is undone here.
 */
export function useLandingPick<T extends { id: string }>(
  /** The project the chip shows: the remembered one, or Unassigned. */
  landing: string | null,
  items: readonly T[] | undefined,
  /** Whether everything the pick reads has settled; the decision waits for it. */
  ready: boolean,
  /** An address or the dialog named a project, so the landing is not the arrival. */
  named: boolean,
  pick: (item: T) => void,
) {
  const decided = useRef(false);
  useEffect(() => {
    if (decided.current || !items || !ready) return;
    decided.current = true;
    if (named) return;
    const item = items.find((candidate) => candidate.id === landing);
    if (item) pick(item);
  }, [landing, items, ready, named, pick]);
}
