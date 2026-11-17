import { useId, useLayoutEffect, useSyncExternalStore } from 'react';

/** The alerts saying "could not reach the server" right now, in the order they mounted. */
let claims: string[] = [];
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setClaims(next: string[]) {
  claims = next;
  for (const listener of listeners) listener();
}

/**
 * Whether this alert is the one that says the server is unreachable. Offline,
 * every read on the page fails the same way (the sidebar's bots and its
 * sessions, say), and one sentence per failed read says nothing the first did
 * not. The first alert to claim it shows it; the rest stay quiet until it
 * goes, then the next in line takes over.
 */
export function useUnreachableClaim(unreachable: boolean): boolean {
  const id = useId();
  // Before paint, so the alerts that lose never flash.
  useLayoutEffect(() => {
    if (!unreachable) return;
    setClaims([...claims, id]);
    return () => setClaims(claims.filter((claim) => claim !== id));
  }, [id, unreachable]);
  const first = useSyncExternalStore(
    subscribe,
    () => claims[0],
    () => undefined,
  );
  // Before its layout effect runs an alert has no claim yet; it shows unless another holds the floor.
  return !unreachable || first === id || first === undefined;
}
