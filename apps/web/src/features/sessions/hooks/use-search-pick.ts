import { useEffect, useRef } from 'react';

/**
 * Apply an id named in the address once the list can answer it: the sidebar's
 * `/sessions/new?project=`, a link's `?host=`, or the id the project dialog
 * just made. The chip needs the entity, not the id, and a project also needs
 * the host list, or a default host not yet listed is skipped as gone. The pick
 * runs once per address: a later change by hand stays, and an id the list
 * does not hold is ignored rather than written.
 */
export function useSearchPick<T extends { id: string }>(
  id: string | undefined,
  items: readonly T[] | undefined,
  /** Whether everything the pick reads has settled; the pick waits for it. */
  ready: boolean,
  pick: (item: T) => void,
) {
  const applied = useRef<string | null>(null);
  useEffect(() => {
    if (!id || !items || !ready || applied.current === id) return;
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return;
    applied.current = id;
    pick(item);
  }, [id, items, ready, pick]);
}
