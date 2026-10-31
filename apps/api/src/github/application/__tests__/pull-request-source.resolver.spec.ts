import type { AccessScope } from '@oppenheimer/backend-authz';
import type { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { describe, expect, it, vi } from 'vitest';
import { GithubErrors } from '../../domain/github.errors';
import type { GithubPullsPort } from '../../infrastructure/github-pulls.port';
import type { GithubAccessResolver } from '../github-access.resolver';
import type { WorkspaceRepository } from '../pull-request-access.port';
import { PullRequestSourceResolver } from '../pull-request-source.resolver';

/**
 * What the listing specs (`pull-request-access.spec.ts`) do not see of the
 * open read: no credential to read the repository with, and how many times
 * the fallback asks for one. The GraphQL whole path, the REST fallback's
 * answer, the rate-limit short-circuit and a refused listing are proven
 * there, through the listings.
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

describe('the open pull requests read falling back to REST', () => {
  // The fallback used to resolve the credential a second time, through the
  // same lookup the GraphQL read had just made.
  it('lists with the credential the GraphQL read resolved, asking for it once', async () => {
    const credential = { token: 'ghs_read', bucket: 'installation:1' };
    const readCredential = vi.fn().mockResolvedValue(credential);
    const pulls = {
      listOpenPullRequests: vi
        .fn()
        .mockRejectedValue(
          new AppError(GithubErrors.UPSTREAM_FAILED, { extensions: { upstreamStatus: 502 } }),
        ),
      listPullRequests: vi.fn().mockResolvedValue([]),
    };
    const source = new PullRequestSourceResolver(
      pulls as unknown as GithubPullsPort,
      {
        getOrSet: vi.fn(async (_key: string, _ttl: number, load: () => Promise<unknown>) => load()),
      } as unknown as CacheService,
      { readCredential } as unknown as GithubAccessResolver,
    );

    const read = await source.open(SCOPE, REPOSITORY);

    expect(read).toMatchObject({ ok: true, credential, whole: [], unfilled: [] });
    expect(readCredential).toHaveBeenCalledTimes(1);
    expect(pulls.listPullRequests).toHaveBeenCalledWith(credential, 'acme-labs/xrp', 'open', 1);
  });
});
