import type { AccessScope } from '@oppenheimer/backend-authz';
import { type CacheService, RedisCacheService } from '@oppenheimer/backend-cache';
import type Redis from 'ioredis';
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

function installation(githubInstallationId = 45678901): GithubInstallationEntity {
  return GithubInstallationEntity.connect({
    organizationId: 'org-acme',
    githubInstallationId,
    accountLogin: 'acme-labs',
    accountType: 'Organization',
    repositorySelection: 'selected',
    installedByUserId: 'ana',
    suspendedAt: null,
  });
}

/**
 * The real cache service over an in-memory stand-in for Redis, so the
 * single-flight under test is the one production runs.
 */
function fakeCache() {
  const store = new Map<string, string>();
  const redis = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, ..._expiry: unknown[]) => {
      store.set(key, value);
      return 'OK';
    }),
  };
  return { cache: new RedisCacheService(redis as unknown as Redis), redis };
}

function build(...found: GithubInstallationEntity[]) {
  const installations = {
    findOneById: vi.fn(async (_scope: AccessScope, id: string) => {
      const match = found.find((candidate) => candidate.id === id);
      return match ? Some(match) : None;
    }),
  } satisfies Pick<GithubInstallationRepositoryPort, 'findOneById'>;

  const github = {
    listInstallationRepositories: vi.fn().mockResolvedValue(REPOSITORIES),
  } satisfies Pick<GithubAppPort, 'listInstallationRepositories'>;

  const { cache, redis } = fakeCache();

  const handler = new ListInstallationRepositoriesQueryHandler(
    installations as unknown as GithubInstallationRepositoryPort,
    github as unknown as GithubAppPort,
    cache as unknown as CacheService,
  );

  return { handler, installations, github, redis };
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

  it('shares one GitHub listing between concurrent requests', async () => {
    // The picker queries on every keystroke: when the entry expires, the
    // requests in flight must not each paginate the whole installation.
    const subject = build(connected);
    const query = new ListInstallationRepositoriesQuery({ scope, installationId: connected.id });

    const results = await Promise.all([
      subject.handler.execute(query),
      subject.handler.execute(query),
    ]);

    expect(results).toEqual([REPOSITORIES, REPOSITORIES]);
    expect(subject.github.listInstallationRepositories).toHaveBeenCalledTimes(1);
  });

  it('keeps one listing per installation, for a minute', async () => {
    const other = installation(99999999);
    const subject = build(connected, other);

    await subject.handler.execute(
      new ListInstallationRepositoriesQuery({ scope, installationId: connected.id }),
    );
    await subject.handler.execute(
      new ListInstallationRepositoriesQuery({ scope, installationId: other.id }),
    );

    // Two installations' listings must never collide, and the TTL is short
    // enough that a repository created a minute ago is there.
    expect(subject.github.listInstallationRepositories.mock.calls).toEqual([
      [45678901],
      [99999999],
    ]);
    for (const call of subject.redis.set.mock.calls) {
      expect(call.slice(2)).toEqual(['EX', 60]);
    }
    expect(subject.redis.set).toHaveBeenCalledTimes(2);
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
    const subject = build();

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
