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
 * repository asked for, it is **never stored or cached**, and an installation
 * that can no longer be exercised says so instead of producing an opaque GitHub
 * error on the host.
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
    suspendedAt: null,
  });
}

function build(found: GithubInstallationEntity | null) {
  const installations = {
    findOneByIdForTokenMint: vi.fn().mockResolvedValue(found ? Some(found) : None),
  } satisfies Pick<GithubInstallationRepositoryPort, 'findOneByIdForTokenMint'>;

  const github = {
    mintRepositoryToken: vi.fn().mockResolvedValue({ token: 'ghs_secret', expiresAt: EXPIRES_AT }),
  } satisfies Pick<GithubAppPort, 'mintRepositoryToken'>;

  const resolver = new RepositoryAccessResolver(
    installations as unknown as GithubInstallationRepositoryPort,
    github as unknown as GithubAppPort,
  );

  return { resolver, installations, github };
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

  it('mints live every time, and keeps nothing', async () => {
    const subject = build(connected);

    await subject.resolver.mintRepositoryToken(connected.id, 831004242);
    await subject.resolver.mintRepositoryToken(connected.id, 831004242);

    // The guarantee the module is built on: a repository removed from the
    // installation stops working on the next mint, not at the end of a cache
    // TTL. A cached secret would also be a stored GitHub credential.
    expect(subject.github.mintRepositoryToken).toHaveBeenCalledTimes(2);
    expect(subject.installations.findOneByIdForTokenMint).toHaveBeenCalledTimes(2);
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
