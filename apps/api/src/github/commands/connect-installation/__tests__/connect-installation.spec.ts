import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GithubInstallationRepositoryPort } from '../../../database/github-installation.repository.port';
import { GithubInstallationEntity } from '../../../domain/github-installation.entity';
import { GithubInstallationMapper } from '../../../github-installation.mapper';
import type {
  GithubAppPort,
  GithubInstallationClaim,
} from '../../../infrastructure/github-app.port';
import { ConnectInstallationCommand } from '../connect-installation.command';
import { ConnectInstallationCommandHandler } from '../connect-installation.command-handler';

/**
 * The claim proof, asserted directly.
 *
 * `POST /installations` takes an installation id from the caller's browser. If
 * the handler trusted it, anyone could post someone else's number and receive
 * one-hour write tokens for their repositories — so the test that matters is the
 * one where GitHub does not list the claimed installation.
 */

const CLAIM: GithubInstallationClaim = {
  githubInstallationId: 45678901,
  accountLogin: 'acme-labs',
  accountType: 'Organization',
  repositorySelection: 'selected',
};

type Installations = Pick<
  GithubInstallationRepositoryPort,
  'insert' | 'save' | 'findOneByGithubInstallationId'
>;
type App = Pick<GithubAppPort, 'isConfigured' | 'listUserInstallations'>;

function build(
  overrides: { visible?: GithubInstallationClaim[]; existing?: GithubInstallationEntity } = {},
) {
  const installations = {
    insert: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockImplementation((entity) => Promise.resolve(entity)),
    findOneByGithubInstallationId: vi
      .fn()
      .mockResolvedValue(overrides.existing ? Some(overrides.existing) : None),
  } satisfies Installations;

  const github = {
    isConfigured: vi.fn().mockReturnValue(true),
    listUserInstallations: vi.fn().mockResolvedValue(overrides.visible ?? [CLAIM]),
  } satisfies App;

  const handler = new ConnectInstallationCommandHandler(
    installations as unknown as GithubInstallationRepositoryPort,
    github as unknown as GithubAppPort,
    new GithubInstallationMapper(),
  );

  return { handler, installations, github };
}

function command(overrides: Partial<ConnectInstallationCommand> = {}) {
  return new ConnectInstallationCommand({
    organizationId: 'org-acme',
    userId: 'ana',
    githubInstallationId: CLAIM.githubInstallationId,
    code: 'the-oauth-code',
    ...overrides,
  });
}

function connected(organizationId: string): GithubInstallationEntity {
  return GithubInstallationEntity.connect({
    organizationId,
    githubInstallationId: CLAIM.githubInstallationId,
    accountLogin: CLAIM.accountLogin,
    accountType: CLAIM.accountType,
    repositorySelection: 'all',
    installedByUserId: 'someone',
  });
}

describe('connect installation', () => {
  let subject: ReturnType<typeof build>;

  beforeEach(() => {
    subject = build();
  });

  it('records the installation GitHub confirms the caller can see', async () => {
    const id = await subject.handler.execute(command());

    expect(subject.github.listUserInstallations).toHaveBeenCalledWith('the-oauth-code');
    expect(subject.installations.insert).toHaveBeenCalledTimes(1);
    const [inserted] = subject.installations.insert.mock.calls[0] as [GithubInstallationEntity];
    expect(inserted.id).toBe(id);
    expect(inserted.organizationId).toBe('org-acme');
    // What is stored is GitHub's answer, not the request body: only the id was
    // ever the caller's to name.
    expect(inserted.accountLogin).toBe('acme-labs');
    expect(inserted.repositorySelection).toBe('selected');
  });

  it('refuses an installation GitHub does not list for the caller', async () => {
    const other = build({ visible: [{ ...CLAIM, githubInstallationId: 999 }] });

    await expect(other.handler.execute(command())).rejects.toMatchObject({ code: 'GITHUB_004' });
    expect(other.installations.insert).not.toHaveBeenCalled();
  });

  it('refuses when GitHub lists nothing at all for the caller', async () => {
    const empty = build({ visible: [] });

    await expect(empty.handler.execute(command())).rejects.toBeInstanceOf(AppError);
    expect(empty.installations.insert).not.toHaveBeenCalled();
  });

  it('refuses an installation another workspace already holds', async () => {
    const taken = build({ existing: connected('org-rival') });

    await expect(taken.handler.execute(command())).rejects.toMatchObject({ code: 'GITHUB_003' });
    expect(taken.installations.save).not.toHaveBeenCalled();
    expect(taken.installations.insert).not.toHaveBeenCalled();
  });

  it('refreshes the workspace’s own installation instead of duplicating it', async () => {
    const existing = connected('org-acme');
    existing.disconnect();
    const again = build({ existing });

    const id = await again.handler.execute(command());

    expect(id).toBe(existing.id);
    expect(again.installations.insert).not.toHaveBeenCalled();
    expect(again.installations.save).toHaveBeenCalledTimes(1);
    // Re-running the install redirect is how a workspace reconnects, and how a
    // changed repository selection reaches us.
    expect(existing.deletedAt).toBeNull();
    expect(existing.repositorySelection).toBe('selected');
    expect(existing.installedByUserId).toBe('ana');
  });

  it('says the App is not configured rather than calling GitHub without credentials', async () => {
    const unconfigured = build();
    unconfigured.github.isConfigured.mockReturnValue(false);

    await expect(unconfigured.handler.execute(command())).rejects.toMatchObject({
      code: 'GITHUB_002',
    });
    expect(unconfigured.github.listUserInstallations).not.toHaveBeenCalled();
  });
});
