'use client';

import { useEffect, useState } from 'react';
import type { HostEntity, HostPairing } from '../modules/hosts/host.entity';
import { useConsumerApp } from './context';
import { useCurrentPairing, useHosts, usePairingTokens } from './hosts.queries';

/** How often a pairing surface asks whether its token has been spent yet. */
const POLL_MS = 3000;

/** What a surface running the pairing flow is showing. */
export interface HostPairingFlow {
  /** The minted token and the two forms of the instruction that spend it. */
  pairing: HostPairing | undefined;
  /** Seconds left on that token. The surface decides how to say it. */
  secondsLeft: number;
  /** Whether the token has run out, so the surface can offer a new one. */
  expired: boolean;
  /** The machine **this token** paired, once a runner has spent it. */
  host: HostEntity | null;
  isPending: boolean;
  error: Error | null;
  /**
   * Replace the token on screen with a fresh one, revoking the one it replaces
   * — a token someone pasted into the wrong window stops working the moment
   * they ask for another, rather than an hour later.
   */
  regenerate: () => void;
}

/**
 * The pairing flow: one token, its clock, and the host that token paired.
 *
 * A file of its own rather than another export in `hosts.queries.ts`: that one
 * is the key factory and the three primitives over the endpoints, and this is
 * the surface flow composed out of them. Two surfaces run it — the onboarding
 * step and the console's Add host dialog — and both go through here rather
 * than polling the host list themselves.
 *
 * One token is minted per visit. The mint is a query, not a mutation fired
 * from an effect — a surface needs exactly one token for as long as it is open,
 * which is what a query keyed to it gives, and `regenerate()` is its refetch.
 * Nothing here has to survive StrictMode by hand.
 *
 * **Correlation is the point.** "The host list is non-empty" is a different
 * question from "this token landed" — an account that already owns a machine
 * answers the first the moment the dialog opens, which would offer a machine
 * nobody had paired. So the poll watches the *token*: the pairing list reports
 * `redeemedHostId` once a runner spends it, and only then is the matching host
 * looked up. A regenerated token is a different id, so the host it offered
 * goes with it.
 *
 * One effect, and it synchronises with the clock. `secondsLeft` is derived
 * from `expiresAt` and the clock rather than decremented, so a backgrounded tab
 * that missed a hundred ticks still shows the right number when it comes back
 * — and it is a count, not a string: `mm:ss` is the surface's, not the flow's.
 */
export function useHostPairing(hostName: string): HostPairingFlow {
  const app = useConsumerApp();
  const { data: pairing, isPending, error, refetch } = useCurrentPairing(hostName);
  const [now, setNow] = useState(() => Date.now());

  // Advance the clock once a second while a token is on screen.
  useEffect(() => {
    if (!pairing) return;

    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [pairing]);

  // Derived in render, not set by the effect: the render that first holds a
  // token already has its count, so it is never read as expired while the
  // effect has yet to run. `now` is at most a tick old.
  const secondsLeft = pairing
    ? Math.max(0, Math.floor((pairing.expiresAt.getTime() - now) / 1000))
    : 0;
  const expired = Boolean(pairing) && secondsLeft <= 0;

  // Poll the token, not the host list. Stops once this token names a host, and
  // once it has expired: a dead token can pair nothing, so polling past that is
  // a request every three seconds that can only answer "no".
  const { data: tokens } = usePairingTokens({
    enabled: Boolean(pairing) && !expired,
    refetchInterval: (query) => {
      if (!pairing || expired) return false;
      const mine = query.state.data?.find((token) => token.id === pairing.id);
      return mine?.redeemedHostId ? false : POLL_MS;
    },
  });

  const redeemedHostId = tokens?.find((token) => token.id === pairing?.id)?.redeemedHostId ?? null;

  // The host row appears when the runner registers; its service may still be
  // starting, so the caller decides what `online` means for its primary action.
  const { data: hosts } = useHosts({
    enabled: Boolean(redeemedHostId),
    refetchInterval: (query) => {
      if (!redeemedHostId) return false;
      const host = query.state.data?.find((row) => row.id === redeemedHostId);
      return host?.online ? false : POLL_MS;
    },
  });

  const host: HostEntity | null = redeemedHostId
    ? (hosts?.find((row) => row.id === redeemedHostId) ?? null)
    : null;

  return {
    pairing,
    secondsLeft,
    expired,
    host,
    isPending,
    error,
    regenerate: () => {
      // A token that already paired a machine is spent, not open; revoking it
      // would be a no-op the API answers with a problem. And a revoke that fails
      // must not keep a fresh token off the screen: the old one still expires
      // within the hour.
      const replaced = pairing && !redeemedHostId && !expired ? pairing.id : null;
      const revoke = replaced
        ? app.hosts.revokePairing(replaced).catch(() => {})
        : Promise.resolve();
      void revoke.then(() => refetch());
    },
  };
}
