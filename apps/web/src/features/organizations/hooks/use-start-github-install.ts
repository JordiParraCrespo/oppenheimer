import { useStartInstallation } from '@oppenheimer/frontend-consumer/react';
import { installUrlWithState } from '@/features/organizations/lib/github-install';

/**
 * Send the browser to GitHub to install the App, with a state minted for it.
 *
 * Minted on click, not on render: every mint is a key in Redis, and this step
 * renders the offer to anyone who opens it. The URL is the API's — the App's
 * install page with `state` already on it — and a walk only prefixes that
 * state so it survives the round trip. The page is left in this tab, as the
 * plain link before it was.
 *
 * No effect: it is an event handler's call, and the navigation it ends in is
 * the browser's, not the router's.
 */
export function useStartGithubInstall(walk?: true) {
  const { mutate, isPending, error } = useStartInstallation();

  return {
    start: () =>
      mutate(undefined, {
        onSuccess: ({ url }) => window.location.assign(installUrlWithState(url, walk)),
      }),
    /** True while the state is being minted, so the offer cannot be pressed twice. */
    isStarting: isPending,
    error,
  };
}
