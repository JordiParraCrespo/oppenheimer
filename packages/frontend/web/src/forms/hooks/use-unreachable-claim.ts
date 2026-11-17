import { type RefObject, useId, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

interface Claim {
  id: string;
  /** The claimant's own Try again, when it has one; read at click time. */
  retry: { current: (() => void) | undefined };
  retries: boolean;
  /** Drawn in a dialog: it always shows, and it neither hides nor is hidden by the page's. */
  ownSurface: boolean;
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
  for (const claim of claims) if (!claim.ownSurface) claim.retry.current?.();
}

/**
 * Whether this alert is the one that says the server is unreachable. Offline,
 * every read on the page fails the same way (the sidebar's bots and its
 * sessions, say), and one sentence per failed read says nothing the first did
 * not. The first alert to claim it shows it; the rest stay quiet until it
 * goes, then the next in line takes over. The one that shows retries for all
 * of them (`retry`), so a quiet section is not left without its Try again.
 *
 * An alert in a dialog (`node` inside `role="dialog"` or `"alertdialog"`)
 * stays out of it: the page's alert sits behind the modal, where the reader
 * can neither see it nor press its Try again.
 */
export function useUnreachableClaim(
  unreachable: boolean,
  retry: (() => void) | undefined,
  node: RefObject<HTMLElement | null>,
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
    const ownSurface = Boolean(node.current?.closest('[role="dialog"],[role="alertdialog"]'));
    setClaims([...claims, { id, retry: latest, retries, ownSurface }]);
    return () => setClaims(claims.filter((claim) => claim.id !== id));
  }, [id, unreachable, retries, node]);
  const current = useSyncExternalStore(
    subscribe,
    () => claims,
    () => claims,
  );
  if (!unreachable) return { speaks: true, retry };
  const mine = current.find((claim) => claim.id === id);
  if (mine?.ownSurface) return { speaks: true, retry };
  const page = current.filter((claim) => !claim.ownSurface);
  const first = page[0]?.id;
  // Not claimed yet (before its layout effect), it is drawn so the effect can
  // see where it sits; a loser's flash never reaches paint.
  const speaks = mine === undefined || first === id;
  const pooled = page.some((claim) => claim.retries);
  return { speaks, retry: pooled ? retryAll : retry };
}
