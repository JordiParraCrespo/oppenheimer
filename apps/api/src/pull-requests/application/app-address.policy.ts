import { AppError } from '@oppenheimer/backend-core';
import { appAddressOf } from '../../github/domain/repository-address.policy';
import type {
  InstallationAddress,
  RepositoryAddress,
} from '../../github/domain/repository-address.types';

/**
 * The address narrowed to the App, or GitHub's own refusal for it
 * (`GITHUB_022`, its catalog title and the domain's detail). The decision is
 * the GitHub domain's {@link appAddressOf}; this only raises it, because the
 * domain may not name `AppError`. A review session, a merge, a review and a
 * line comment all call it before they reach GitHub.
 */
export function requireApp<T extends RepositoryAddress>(
  address: T,
): Extract<T, InstallationAddress> {
  const app = appAddressOf(address);
  if (app.kind === 'refused') throw new AppError(app.error, { detail: app.detail });
  return app;
}
