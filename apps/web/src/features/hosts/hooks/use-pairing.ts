import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { useHostPairing } from '@oppenheimer/frontend-consumer/react';

/**
 * When a pairing surface lets the reader move on.
 *
 * Two rules, on purpose (`product/versions/mvp/05-screens.md`, Add a host):
 * - `online` — onboarding's Continue. The host row appears when the runner
 *   registers and its service may still be starting; a first-run flow that
 *   ends on a machine which never came up has claimed one the console cannot
 *   use, so it waits for the runner to dial in.
 * - `registered` — the console's Use this host and Settings' Done. They pick
 *   a host, and a session may be started on a machine whose runner is still
 *   coming up: the control plane owes it to the host the moment it connects,
 *   which is what the host chip's offline rows mean too.
 */
export type PairingDoneWhen = 'online' | 'registered';

/**
 * One pairing surface's flow: the token, the host it paired, whether the
 * surface is done by its rule, and the props the kit's `HostPairingChrome`
 * takes, ready to spread. The onboarding step, the console's dialog and the
 * Settings page draw different frames around the same flow; this is the part
 * they share.
 */
export function usePairing(defaultName: string, doneWhen: PairingDoneWhen) {
  const { pairing, expiresAt, expired, host, isPending, error, regenerate } =
    useHostPairing(defaultName);

  return {
    host,
    done: isDone(host, doneWhen),
    chrome: {
      pairing: pairing ?? null,
      expiresAt,
      expired,
      onRegenerate: regenerate,
      busy: isPending,
      host,
      error,
    },
  };
}

function isDone(host: HostEntity | null, doneWhen: PairingDoneWhen): boolean {
  if (!host) return false;
  return doneWhen === 'online' ? host.online : true;
}
