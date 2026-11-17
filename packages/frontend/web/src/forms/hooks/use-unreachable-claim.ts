import { useId, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

interface Claim {
  id: string;
  /** The claimant's own Try again, when it has one; read at click time. */
  retry: { current: (() => void) | undefined };
  retries: boolean;
}

/** The alerts saying "could not reach the server" right now, in the order they mounted. */
let claims: Claim[] = [];
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setClaims(next: Claim[]) {
  claims = next;
  for (const listener of listeners) listener();
}

function retryAll() {
  for (const claim of claims) claim.retry.current?.();
}

/**
 * Whether this alert is the one that says the server is unreachable. Offline,
 * every read on the page fails the same way (the sidebar's bots and its
 * sessions, say), and one sentence per failed read says nothing the first did
 * not. The first alert to claim it shows it; the rest stay quiet until it
 * goes, then the next in line takes over. The one that shows retries for all
 * of them (`retry`), so a quiet section is not left without its Try again.
 */
export function useUnreachableClaim(
  unreachable: boolean,
  retry: (() => void) | undefined,
): { speaks: boolean; retry: (() => void) | undefined } {
  const id = useId();
  const latest = useRef(retry);
  useLayoutEffect(() => {
    latest.current = retry;
  });
  const retries = retry !== undefined;
  // Before paint, so the alerts that lose never flash.
  useLayoutEffect(() => {
    if (!unreachable) return;
    setClaims([...claims, { id, retry: latest, retries }]);
    return () => setClaims(claims.filter((claim) => claim.id !== id));
  }, [id, unreachable, retries]);
  const current = useSyncExternalStore(
    subscribe,
    () => claims,
    () => claims,
  );
  if (!unreachable) return { speaks: true, retry };
  // Before its layout effect runs an alert has no claim yet; it shows unless another holds the floor.
  const first = current[0]?.id;
  const speaks = first === id || first === undefined;
  const pooled = current.some((claim) => claim.retries);
  return { speaks, retry: pooled ? retryAll : retry };
}
