import { useEffect, useRef } from 'react';

/**
 * Apply an id named in the address once the list can answer it.
 *
 * The external system is the URL: the sidebar's "New session here" names a
 * project in `/sessions/new?project=`, and a link may name a machine in
 * `?host=`; the project chip also hands it the id the project dialog just
 * made. The chip has to start on it, which needs the entity and not just the
 * id — and, for a project, the host list, since a default host the list has
 * not answered for yet would be skipped as if it were gone. The pick runs once per address: a value the reader then changes
 * by hand stays changed, and an id the list does not hold is ignored rather
 * than written.
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
