import { useEffect, useRef } from 'react';

/**
 * Apply an id named in the address once the list can answer it.
 *
 * The external system is the URL: the sidebar's "New session here" names a
 * project in `/sessions/new?project=`, and a link may name a machine in
 * `?host=`; the project chip also hands it the id the project dialog just
 * made. The chip has to start on it, which needs the
 * entity and not just the id — and, for a project, the host list, since a
 * default host the list has not answered for yet would be skipped as if it
 * were gone. The pick runs once per address: a value the reader then changes
 * by hand stays changed, and an id the list does not hold is ignored rather
 * than written.
 *
 * `fallback` is what the screen landed on when the address named nothing —
 * for the project chip, the project it starts on (the one the last visit
 * remembered, or Unassigned). It is picked the same way, but only while
 * nothing has been: it is the arrival, and once a pick has been applied, a
 * later address with no id leaves the draft as the reader has it.
 */
export function useSearchPick<T extends { id: string }>(
  id: string | undefined,
  items: readonly T[] | undefined,
  /** Whether everything the pick reads has settled; the pick waits for it. */
  ready: boolean,
  pick: (item: T) => void,
  fallback?: string | null,
) {
  const applied = useRef<string | null>(null);
  useEffect(() => {
    const target = id ?? (applied.current === null ? fallback : undefined);
    if (!target || !items || !ready || applied.current === target) return;
    const item = items.find((candidate) => candidate.id === target);
    if (!item) return;
    applied.current = target;
    pick(item);
  }, [id, fallback, items, ready, pick]);
}
