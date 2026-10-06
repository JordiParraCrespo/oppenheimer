import { useStartInstallation } from '@oppenheimer/frontend-consumer/react';
import { useOpenMinted } from '@oppenheimer/frontend-web';

/**
 * Send the browser to GitHub to install the App, with a state minted for it,
 * in this tab: onboarding is a walk, and GitHub brings the reader back to it.
 * `installUrlFor` is the caller's say over the address (the first-run walk
 * prefixes the state so it survives the round trip).
 */
export function useStartGithubInstall(installUrlFor: (installUrl: string) => string) {
  const { open, isOpening, error } = useOpenMinted(useStartInstallation(), {
    target: 'self',
    urlFor: installUrlFor,
  });

  return { start: open, isStarting: isOpening, error };
}
