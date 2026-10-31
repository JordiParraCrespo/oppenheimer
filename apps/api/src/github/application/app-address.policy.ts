import { AppError } from '@oppenheimer/backend-core';
import { GithubErrors } from '../domain/github.errors';
import { isInstallationAddress } from '../domain/repository-address.policy';
import type { InstallationAddress, RepositoryAddress } from '../domain/repository-address.types';

/**
 * The address narrowed to the App, for what only the App can do (writes in
 * the caller's name, a session that clones); `GITHUB_022` for one read
 * through a token (§6.2).
 *
 * {@link isInstallationAddress} plus the refusal, and nothing else. It is not
 * in `domain/` only because the refusal is an `AppError`, which the domain
 * may not name; it is published to other modules beside the domain for the
 * same reason (`.dependency-cruiser.cjs`).
 */
export function requireApp<T extends RepositoryAddress>(
  address: T,
): Extract<T, InstallationAddress> {
  if (isInstallationAddress(address)) return address;
  throw new AppError(GithubErrors.READ_ONLY_REPOSITORY, {
    detail: `Repository ${address.githubRepoId} is read through your own GitHub token.`,
  });
}
