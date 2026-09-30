import { useStartInstallation } from '@oppenheimer/frontend-consumer/react';

/**
 * Send the browser to GitHub to install the App, with a state minted for it.
 *
 * Minted on click, not on render: every mint is a key in Redis, and this step
 * renders the offer to anyone who opens it. The URL is the API's — the App's
 * install page with `state` already on it — and `installUrlFor` is the
 * caller's say over it (the first-run walk prefixes that state so it survives
 * the round trip). The page is left in this tab, as the plain link before it
 * was.
 */
export function useStartGithubInstall(installUrlFor: (installUrl: string) => string) {
  const { mutate, isPending, error } = useStartInstallation();

  return {
    start: () =>
      mutate(undefined, {
        onSuccess: ({ url }) => window.location.assign(installUrlFor(url)),
      }),
    /** True while the state is being minted, so the offer cannot be pressed twice. */
    isStarting: isPending,
    error,
  };
}
