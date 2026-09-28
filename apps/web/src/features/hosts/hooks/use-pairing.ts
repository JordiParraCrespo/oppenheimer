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
 * `useHostPairing`, plus whether the surface is done by its rule. The flow's
 * fields are passed on as they are; each surface draws what it needs of them.
 */
export function usePairing(defaultName: string, doneWhen: PairingDoneWhen) {
  const flow = useHostPairing(defaultName);
  const done = doneWhen === 'online' ? Boolean(flow.host?.online) : flow.host !== null;
  return { ...flow, done };
}
