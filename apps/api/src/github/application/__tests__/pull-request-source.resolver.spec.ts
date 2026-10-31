import type { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { describe, expect, it, vi } from 'vitest';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { GithubErrors } from '../../domain/github.errors';
import type { GithubPullsPort } from '../../infrastructure/github-pulls.port';
import type { GithubAccessResolver } from '../github-access.resolver';
import type { WorkspaceRepository } from '../pull-request-access.port';
import { PullRequestSourceResolver } from '../pull-request-source.resolver';

/**
 * The one branch of the open read the listing specs
 * (`pull-request-access.spec.ts`) do not reach: no credential to read the
 * repository with. The GraphQL whole path, the REST fallback, the rate-limit
 * short-circuit and a refused listing are proven there, through the listings.
 */
const SCOPE = { userId: 'ana', organizationId: 'org-acme' } as unknown as AccessScope;
const REPOSITORY: WorkspaceRepository = {
  kind: 'installation',
  installationId: 'inst',
  githubRepoId: 821374923,
  name: 'xrp',
  fullName: 'acme-labs/xrp',
  defaultBranch: 'main',
  private: true,
};

describe('the open pull requests of a repository with no credential to read it', () => {
  it('answers the refusal and asks GitHub nothing', async () => {
    const pulls = { listOpenPullRequests: vi.fn(), listPullRequests: vi.fn() };
    const source = new PullRequestSourceResolver(
      pulls as unknown as GithubPullsPort,
      { getOrSet: vi.fn() } as unknown as CacheService,
      {
        readCredential: vi
          .fn()
          .mockRejectedValue(new AppError(GithubErrors.INSTALLATION_SUSPENDED)),
      } as unknown as GithubAccessResolver,
    );

    await expect(source.open(SCOPE, REPOSITORY)).resolves.toEqual({
      ok: false,
      refusal: 'forbidden',
    });
    expect(pulls.listOpenPullRequests).not.toHaveBeenCalled();
    expect(pulls.listPullRequests).not.toHaveBeenCalled();
  });
});
