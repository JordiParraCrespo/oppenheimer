import type { CacheService } from '@oppenheimer/backend-cache';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GithubInstallationRepositoryPort } from '../../database/github-installation.repository.port';
import { GithubInstallationEntity } from '../../domain/github-installation.entity';
import type { GithubAppPort } from '../../infrastructure/github-app.port';
import { RepositoryAccessResolver } from '../repository-access.resolver';

/**
 * The seam `sessions/` and `relay/` will inject.
 *
 * A repository token is the one credential this platform hands to a machine it
 * does not run, so the properties worth pinning are: it is narrowed to the one
 * repository asked for, it is cached short of its own expiry rather than stored,
 * and an installation that can no longer be exercised says so instead of
 * producing an opaque GitHub error on the host.
 */

const EXPIRES_AT = new Date('2026-09-19T12:00:00.000Z');

function installation(): GithubInstallationEntity {
  return GithubInstallationEntity.connect({
    organizationId: 'org-acme',
    githubInstallationId: 45678901,
    accountLogin: 'acme-labs',
    accountType: 'Organization',
    repositorySelection: 'selected',
    installedByUserId: 'ana',
  });
}

function fakeCache() {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    del: vi.fn(),
    reset: vi.fn(),
  };
}

function build(found: GithubInstallationEntity | null) {
  const installations = {
    findOneByIdForTokenMint: vi.fn().mockResolvedValue(found ? Some(found) : None),
  } satisfies Pick<GithubInstallationRepositoryPort, 'findOneByIdForTokenMint'>;

  const github = {
    mintRepositoryToken: vi.fn().mockResolvedValue({ token: 'ghs_secret', expiresAt: EXPIRES_AT }),
  } satisfies Pick<GithubAppPort, 'mintRepositoryToken'>;

  const cache = fakeCache();

  const resolver = new RepositoryAccessResolver(
    installations as unknown as GithubInstallationRepositoryPort,
    github as unknown as GithubAppPort,
    cache as unknown as CacheService,
  );

  return { resolver, installations, github, cache };
}

describe('repository access', () => {
  let connected: GithubInstallationEntity;

  beforeEach(() => {
    connected = installation();
  });

  it('mints a token for the one repository asked for', async () => {
    const subject = build(connected);

    const token = await subject.resolver.mintRepositoryToken(connected.id, 831004242);

    expect(token).toEqual({ token: 'ghs_secret', expiresAt: EXPIRES_AT, githubRepoId: 831004242 });
    // GitHub's installation id, not ours: the control-plane uuid is what a
    // checkout records, and translating it here is this resolver's job.
    expect(subject.github.mintRepositoryToken).toHaveBeenCalledWith(45678901, 831004242);
  });

  it('caches per repository, short of the token’s own expiry', async () => {
    const subject = build(connected);

    await subject.resolver.mintRepositoryToken(connected.id, 831004242);
    const again = await subject.resolver.mintRepositoryToken(connected.id, 831004242);

    expect(again.expiresAt).toEqual(EXPIRES_AT);
    expect(subject.github.mintRepositoryToken).toHaveBeenCalledTimes(1);
    expect(subject.cache.set).toHaveBeenCalledWith(
      `github:token:${connected.id}:831004242`,
      { token: 'ghs_secret', expiresAt: EXPIRES_AT.toISOString() },
      55 * 60,
    );
  });

  it('does not serve one repository’s token for another', async () => {
    const subject = build(connected);

    await subject.resolver.mintRepositoryToken(connected.id, 831004242);
    await subject.resolver.mintRepositoryToken(connected.id, 999);

    expect(subject.github.mintRepositoryToken).toHaveBeenCalledTimes(2);
  });

  it('refuses a suspended installation before asking GitHub', async () => {
    connected.suspend();
    const subject = build(connected);

    await expect(
      subject.resolver.mintRepositoryToken(connected.id, 831004242),
    ).rejects.toMatchObject({ code: 'GITHUB_008' });
    expect(subject.github.mintRepositoryToken).not.toHaveBeenCalled();
  });

  it('refuses an installation no workspace holds', async () => {
    const subject = build(null);

    await expect(
      subject.resolver.mintRepositoryToken('11111111-1111-4111-8111-111111111111', 831004242),
    ).rejects.toMatchObject({ code: 'GITHUB_001' });
    expect(subject.github.mintRepositoryToken).not.toHaveBeenCalled();
  });
});
