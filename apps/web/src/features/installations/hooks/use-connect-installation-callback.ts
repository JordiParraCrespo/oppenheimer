import type { InstallationEntity } from '@oppenheimer/frontend-consumer';
import { useConnectInstallation } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useRef } from 'react';

/**
 * Exchange the `installation_id`, `code` and `state` GitHub put on the return
 * leg, once per state: both are one-shot and a second POST fails, so
 * `exchanged` guards against React's dev double invoke and a mid-flight
 * re-render.
 *
 * **No state, no post.** The state is the nonce this console minted on
 * Connect; a callback without one (someone else's half-finished install link,
 * GitHub's own "Configure" redirect) would connect whoever's installation it
 * is to this workspace, so the hook reports `unstarted` instead.
 *
 * The parameters are cleared on success only, so a failed exchange can still
 * tell a refusal from never having tried; the guard already stops a refresh
 * re-posting a dead code. Clearing is the route's (`onExchanged`): it owns the
 * search and what else the URL must keep.
 *
 * **A request is an outcome too.** A member who is not an owner of the
 * organization they picked can only ask for the install: GitHub comes back with
 * `setup_action=request` and no installation, and the approval reaches the
 * owner, not this tab. Nothing is posted, and `requested` says so, so the
 * screen offers Connect GitHub again rather than an older installation.
 *
 * Returns the installation it connected, so the caller renders that row rather
 * than guessing at the head of a list.
 */
export function useConnectInstallationCallback(
  githubInstallationId?: number,
  code?: string,
  state?: string,
  setupAction?: string,
  onExchanged?: () => void,
) {
  const { mutate, data: connected, isPending, error } = useConnectInstallation();
  const exchanged = useRef<string | null>(null);

  useEffect(() => {
    if (!githubInstallationId || !code || !state) return;
    if (exchanged.current === state) return;
    exchanged.current = state;

    mutate({ githubInstallationId, code, state }, { onSuccess: () => onExchanged?.() });
  }, [githubInstallationId, code, state, onExchanged, mutate]);

  return {
    isExchanging: isPending,
    connected: connected as InstallationEntity | undefined,
    /** A GitHub callback that carried no state this console minted: never posted. */
    unstarted: Boolean(githubInstallationId && code && !state),
    /** GitHub came back from an install request: an owner has to approve it first. */
    requested: setupAction === 'request' && !githubInstallationId,
    error,
  };
}
