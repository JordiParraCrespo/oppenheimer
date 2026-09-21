import { type HostEntity, type HostPairing } from '@oppenheimer/frontend-consumer';
import { useHosts, usePairHost } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useRef, useState } from 'react';

/** How often the step asks whether a runner has dialled in yet. */
const POLL_MS = 3000;

/**
 * The pairing token Add host shows, its clock, and the host it pairs.
 *
 * One token is minted when the step opens — `POST /hosts/pairing` returns the
 * install command and the agent prompt with the secret already in them, since
 * the secret is shown once and the server is the only place that knows it.
 *
 * `hostName` is the name the machine adopts when its runner registers: the
 * token carries it, so it is chosen before the machine exists. The step has no
 * field for it (the artboard has none), so it is a default the reader renames
 * from Settings afterwards.
 *
 * Two effects, each synchronising with something outside React: the
 * one-second tick that counts the token down, and the mint itself, which is
 * fired once per mount rather than on every render. The host list is not an
 * effect — it is a polled query, and it stops polling once a host appears.
 */
export function usePairingToken(hostName: string) {
  const { mutate: mint, data: pairing, isPending, error } = usePairHost();
  const [seconds, setSeconds] = useState(0);
  const minted = useRef(false);

  // Synchronises with the mount: mint exactly one token per visit, never one
  // per render. StrictMode invokes effects twice in development, and a second
  // mint would hand the reader a command whose token the first one replaced.
  useEffect(() => {
    if (minted.current) return;
    minted.current = true;
    mint(hostName);
  }, [mint, hostName]);

  // Synchronises with the clock. Recomputed from `expiresAt` rather than
  // decremented from a fixed lifetime, so a backgrounded tab that missed a
  // hundred ticks still shows the right number when it comes back.
  useEffect(() => {
    if (!pairing) return;

    const remaining = () =>
      Math.max(0, Math.floor((pairing.expiresAt.getTime() - Date.now()) / 1000));

    setSeconds(remaining());
    const tick = setInterval(() => setSeconds(remaining()), 1000);
    return () => clearInterval(tick);
  }, [pairing]);

  // The host appears when its runner registers, which happens on the machine,
  // not here — so this is a poll. It stops as soon as one is found, and while
  // the token is still alive: a dead token can pair nothing, and polling on
  // past it is a request per three seconds that can only answer "no".
  const { data: hosts } = useHosts({
    refetchInterval: (query) =>
      (query.state.data?.length ?? 0) > 0 || seconds <= 0 ? false : POLL_MS,
  });

  const host: HostEntity | null = hosts?.[0] ?? null;
  const minutes = Math.floor(seconds / 60);
  const countdown = `${minutes}:${String(seconds % 60).padStart(2, '0')}`;

  return {
    pairing: pairing as HostPairing | undefined,
    countdown,
    /** Whether the token has run out, so the step can offer a new one. */
    expired: Boolean(pairing) && seconds <= 0,
    host,
    isPending,
    error,
    regenerate: () => mint(hostName),
  };
}
