import type { AccessScope } from '@oppenheimer/backend-authz';
import type { CacheService } from '@oppenheimer/backend-cache';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GithubInstallationRepositoryPort } from '../../../database/github-installation.repository.port';
import { GithubInstallationEntity } from '../../../domain/github-installation.entity';
import type { GithubAppPort, GithubRepository } from '../../../infrastructure/github-app.port';
import { ListInstallationRepositoriesQuery } from '../list-installation-repositories.query';
import { ListInstallationRepositoriesQueryHandler } from '../list-installation-repositories.query-handler';

/**
 * The listing is live and never mirrored, so the only thing between the picker
 * and GitHub's rate limit is this cache. These tests pin the two halves that
 * matter: it is keyed per installation, and a repository a workspace cannot
 * reach never reaches GitHub at all.
 */

const REPOSITORIES: GithubRepository[] = [
  {
    githubRepoId: 831004242,
    name: 'oppenheimer',
    fullName: 'acme-labs/oppenheimer',
    defaultBranch: 'main',
    private: true,
    archived: false,
    pushedAt: '2026-09-18T10:00:00.000Z',
  },
];

const scope: AccessScope = {
  userId: 'ana',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function installation(): GithubInstallationEntity {
  return GithubInstallationEntity.connect({
    organizationId: 'org-acme',
    githubInstallationId: 45678901,
    accountLogin: 'acme-labs',
    accountType: 'Organization',
    repositorySelection: 'selected',
    installedByUserId: 'ana',
    suspendedAt: null,
  });
}

/** A cache that behaves like Redis does for this handler, without Redis. */
function fakeCache() {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    del: vi.fn(),
    reset: vi.fn(),
    ttls: [] as (number | undefined)[],
  };
}

function build(found: GithubInstallationEntity | null) {
  const installations = {
    findOneById: vi.fn().mockResolvedValue(found ? Some(found) : None),
  } satisfies Pick<GithubInstallationRepositoryPort, 'findOneById'>;

  const github = {
    listInstallationRepositories: vi.fn().mockResolvedValue(REPOSITORIES),
  } satisfies Pick<GithubAppPort, 'listInstallationRepositories'>;

  const cache = fakeCache();

  const handler = new ListInstallationRepositoriesQueryHandler(
    installations as unknown as GithubInstallationRepositoryPort,
    github as unknown as GithubAppPort,
    cache as unknown as CacheService,
  );

  return { handler, installations, github, cache };
}

describe('list installation repositories', () => {
  let connected: GithubInstallationEntity;

  beforeEach(() => {
    connected = installation();
  });

  it('asks GitHub once and serves the rest from the cache', async () => {
    const subject = build(connected);
    const query = new ListInstallationRepositoriesQuery({ scope, installationId: connected.id });

    expect(await subject.handler.execute(query)).toEqual(REPOSITORIES);
    expect(await subject.handler.execute(query)).toEqual(REPOSITORIES);

    expect(subject.github.listInstallationRepositories).toHaveBeenCalledTimes(1);
    expect(subject.github.listInstallationRepositories).toHaveBeenCalledWith(45678901);
  });

  it('caches under a key of its own per installation, for a minute', async () => {
    const subject = build(connected);
    await subject.handler.execute(
      new ListInstallationRepositoriesQuery({ scope, installationId: connected.id }),
    );

    // One key per installation: two workspaces' listings must never collide, and
    // the TTL is short enough that a repository created a minute ago is there.
    expect(subject.cache.set).toHaveBeenCalledWith(
      `github:repositories:${connected.id}`,
      REPOSITORIES,
      60,
    );
  });

  it('re-reads the installation under the caller’s scope every time', async () => {
    const subject = build(connected);
    const query = new ListInstallationRepositoriesQuery({ scope, installationId: connected.id });

    await subject.handler.execute(query);
    await subject.handler.execute(query);

    // The cache is of GitHub's answer, not of the authorization: a caller who
    // lost access must not be served a warm listing.
    expect(subject.installations.findOneById).toHaveBeenCalledTimes(2);
    expect(subject.installations.findOneById).toHaveBeenCalledWith(scope, connected.id);
  });

  it('never reaches GitHub for an installation outside the caller’s scope', async () => {
    const subject = build(null);

    await expect(
      subject.handler.execute(
        new ListInstallationRepositoriesQuery({ scope, installationId: connected.id }),
      ),
    ).rejects.toMatchObject({ code: 'GITHUB_001' });
    expect(subject.github.listInstallationRepositories).not.toHaveBeenCalled();
  });

  it('refuses a suspended installation instead of asking GitHub', async () => {
    connected.suspend();
    const subject = build(connected);

    await expect(
      subject.handler.execute(
        new ListInstallationRepositoriesQuery({ scope, installationId: connected.id }),
      ),
    ).rejects.toMatchObject({ code: 'GITHUB_008' });
    expect(subject.github.listInstallationRepositories).not.toHaveBeenCalled();
  });
});
