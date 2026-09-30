'use client';

import { useEffect, useState } from 'react';
import type { HostEntity, HostPairing } from '../modules/hosts/host.entity';
import {
  useCurrentPairing,
  useHostList,
  usePairingTokens,
  useReplacePairing,
} from './hosts.queries';
import { pollWhile } from './live-poll';

/** The longest delay `setTimeout` honours; a later one fires at once. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/** What a surface running the pairing flow is showing. */
export interface HostPairingFlow {
  /** The minted token and the two forms of the instruction that spend it. */
  pairing: HostPairing | undefined;
  /**
   * When that token runs out. A countdown is the surface's to draw, in the
   * leaf that shows it (the kit's `TokenCountdown`), so its per-second tick
   * re-renders that leaf and not the whole dialog or step.
   */
  expiresAt: Date | null;
  /** Whether the token has run out, so the surface can offer a new one. */
  expired: boolean;
  /** The machine **this token** paired, once a runner has spent it. */
  host: HostEntity | null;
  isPending: boolean;
  error: Error | null;
  /**
   * Replace the token on screen with a fresh one, revoking the one it replaces
   * in the same write — a token someone pasted into the wrong window stops
   * working the moment they ask for another, rather than an hour later. If
   * the mint is refused, the old token stays on screen and stays spendable.
   */
  regenerate: () => void;
}

/**
 * The pairing flow: one token, its clock, and the host that token paired.
 * Every pairing surface (onboarding's step, the Add host dialog and screen)
 * runs it rather than polling the host list itself.
 *
 * **Correlation is the point.** An account that already owns a machine has a
 * non-empty host list the moment the dialog opens, which would offer a machine
 * nobody had paired. So the poll watches the *token*: the pairing list reports
 * `redeemedHostId` once a runner spends it, and only then is the host looked
 * up. A regenerated token is a different id, so the host it offered goes with
 * it.
 */
export function useHostPairing(hostName: string): HostPairingFlow {
  const { data: pairing, isPending, error } = useCurrentPairing(hostName);
  const replace = useReplacePairing(hostName);
  // The token that has run out, by id, so a regenerated token starts unexpired
  // without anything having to reset this.
  const [expiredId, setExpiredId] = useState<string | null>(null);

  // The clock: one timeout per token, at the moment it expires. A background
  // tab's timers are throttled but never fire early, so the token is never
  // called dead while it can still pair.
  useEffect(() => {
    if (!pairing) return;

    const remaining = pairing.expiresAt.getTime() - Date.now();
    if (remaining > MAX_TIMEOUT_MS) return;
    const timer = setTimeout(() => setExpiredId(pairing.id), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [pairing]);

  // A fresh token is never read as expired, not even for the render it
  // arrives in: nothing here has expired it yet.
  const expired = Boolean(pairing) && expiredId === pairing?.id;

  // Stops once this token names a host, and once it has expired: a dead token
  // can pair nothing, so polling past that is a request every three seconds
  // that can only answer "no".
  const { data: tokens } = usePairingTokens(
    { enabled: Boolean(pairing) && !expired },
    pollWhile('pairing', (rows) => {
      if (!pairing || expired) return false;
      return !rows?.find((token) => token.id === pairing.id)?.redeemedHostId;
    }),
  );

  const redeemedHostId = tokens?.find((token) => token.id === pairing?.id)?.redeemedHostId ?? null;

  // The host row appears when the runner registers; its service may still be
  // starting, so the caller decides what `online` means for its primary action.
  const { data: hosts } = useHostList(
    { enabled: Boolean(redeemedHostId) },
    pollWhile('pairing', (rows) => {
      if (!redeemedHostId) return false;
      return !rows?.find((row) => row.id === redeemedHostId)?.online;
    }),
  );

  const host: HostEntity | null = redeemedHostId
    ? (hosts?.find((row) => row.id === redeemedHostId) ?? null)
    : null;

  return {
    pairing,
    expiresAt: pairing?.expiresAt ?? null,
    expired,
    host,
    isPending: isPending || replace.isPending,
    error: error ?? replace.error,
    regenerate: () => {
      // A token that already paired a machine, or ran out, is spent: there is
      // nothing left to revoke, so the replacement is a plain mint.
      const replaces = pairing && !redeemedHostId && !expired ? pairing.id : undefined;
      replace.mutate(replaces);
    },
  };
}
