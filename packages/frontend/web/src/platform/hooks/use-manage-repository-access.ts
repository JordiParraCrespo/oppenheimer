import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { type MintAddress, useOpenMinted } from './use-open-minted';

/**
 * "Manage repository access", for every repository picker: the GitHub App's
 * install page in a new tab, which is where an account or an organization is
 * given to the App. `onManage` is absent when the deployment has no App, so
 * the picker drops the row rather than pointing at a GitHub 404.
 *
 * `onReturn` is the caller's: the install is connected in the other tab, and
 * this one's cache knows nothing of it until it reads the installations again.
 */
export function useManageRepositoryAccess(mint: MintAddress, onReturn: () => void) {
  const hasApp = useDeploymentCapabilities({
    select: (deployment) => Boolean(deployment.github_app_install_url),
  });
  const { open, error, dismiss } = useOpenMinted(mint, { target: 'tab', onReturn });

  return { onManage: hasApp.data ? open : undefined, isPending: hasApp.isPending, error, dismiss };
}
