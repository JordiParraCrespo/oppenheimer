import type { HostEntity } from '@oppenheimer/frontend-consumer';
import {
  useCurrentPairing,
  useHosts,
  usePairingTokens,
} from '@oppenheimer/frontend-consumer/react';
import { useEffect, useState } from 'react';

/** How often the step asks whether this token has been spent yet. */
const POLL_MS = 3000;

/**
 * The pairing token Add host shows, its clock, and the host **this token**
 * paired.
 *
 * One token is minted per visit. The mint is a query, not a mutation fired
 * from an effect — the step needs exactly one token for as long as it is open,
 * which is what a query keyed to the screen gives, and `regenerate()` is its
 * refetch. Nothing here has to survive StrictMode by hand.
 *
 * Correlation is the point. "The host list is non-empty" is a different
 * question from "this token landed" — an account that already owns a machine
 * answers the first the moment the step opens, which would enable Continue
 * under a command nobody has run. So the poll watches the *token*: the pairing
 * list reports `redeemedHostId` once a runner spends it, and only then is the
 * matching host looked up.
 *
 * One effect, and it synchronises with the clock. The countdown is recomputed
 * from `expiresAt` rather than decremented, so a backgrounded tab that missed
 * a hundred ticks still shows the right number when it comes back.
 */
export function usePairingToken(hostName: string) {
  const { data: pairing, isPending, error, refetch } = useCurrentPairing(hostName);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!pairing) return;

    const remaining = () =>
      Math.max(0, Math.floor((pairing.expiresAt.getTime() - Date.now()) / 1000));

    setSeconds(remaining());
    const tick = setInterval(() => setSeconds(remaining()), 1000);
    return () => clearInterval(tick);
  }, [pairing]);

  const expired = Boolean(pairing) && seconds <= 0;

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
  // starting, so the caller decides what `online` means for Continue.
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

  const minutes = Math.floor(seconds / 60);
  const countdown = `${minutes}:${String(seconds % 60).padStart(2, '0')}`;

  return {
    pairing,
    countdown,
    /** Whether the token has run out, so the step can offer a new one. */
    expired,
    host,
    isPending,
    error,
    /** Replace the token on screen with a fresh one. */
    regenerate: () => refetch(),
  };
}
