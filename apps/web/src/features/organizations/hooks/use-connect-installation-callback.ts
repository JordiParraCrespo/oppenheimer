import type { InstallationEntity } from '@oppenheimer/frontend-consumer';
import { useConnectInstallation } from '@oppenheimer/frontend-consumer/react';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

/**
 * Exchange the `installation_id`, `code` and `state` GitHub put on the return
 * leg.
 *
 * The effect synchronises with the URL — the one system React does not own
 * here. It runs once per state: `exchanged` guards against React's double
 * invoke in development and against a re-render mid-flight, because the state
 * and the code are both one-shot and a second POST with them fails.
 *
 * **No state, no post.** The state is the nonce this console minted when the
 * reader pressed Connect; a callback without one was not started here — a link
 * someone else stopped halfway through their own install, or GitHub's own
 * "Configure" redirect. Posting it would connect whoever's installation it is
 * to this workspace, so the hook reports `unstarted` and the step says so.
 *
 * The parameters are cleared **on success only**. They are spent either way,
 * but a failed exchange still needs to say which attempt failed: dropping them
 * leaves the step reading "not connected" under a generic alert, with no way
 * to tell a refusal from never having tried. The guard already stops a refresh
 * from re-posting a dead code.
 *
 * Clearing them means writing the search, and the search is also where the
 * first-run walk lives, so `walk` is put back rather than swept away with the
 * spent code — otherwise installing the App mid-walk is the one path through
 * the flow that loses it, and Ready turns the reader away two clicks later.
 *
 * Returns the installation it connected, so the caller renders the row it just
 * wrote rather than guessing at the head of a list.
 */
export function useConnectInstallationCallback(
  githubInstallationId?: number,
  code?: string,
  state?: string,
  walk?: true,
) {
  const navigate = useNavigate();
  const { mutate, data: connected, isPending, error } = useConnectInstallation();
  const exchanged = useRef<string | null>(null);

  useEffect(() => {
    if (!githubInstallationId || !code || !state) return;
    if (exchanged.current === state) return;
    exchanged.current = state;

    mutate(
      { githubInstallationId, code, state },
      {
        onSuccess: () =>
          navigate({ to: '/onboarding/github', search: walk ? { walk } : {}, replace: true }),
      },
    );
  }, [githubInstallationId, code, state, walk, mutate, navigate]);

  return {
    /** True while the code is being exchanged, so the step can hold its place. */
    isExchanging: isPending,
    /** The installation this visit connected, if it did. */
    connected: connected as InstallationEntity | undefined,
    /** A GitHub callback that carried no state this console minted: never posted. */
    unstarted: Boolean(githubInstallationId && code && !state),
    error,
  };
}
