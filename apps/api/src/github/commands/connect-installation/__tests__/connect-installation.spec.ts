import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GithubInstallationRepositoryPort } from '../../../database/github-installation.repository.port';
import { GithubErrors } from '../../../domain/github.errors';
import { GithubInstallationEntity } from '../../../domain/github-installation.entity';
import { GithubInstallationMapper } from '../../../github-installation.mapper';
import type {
  GithubAppPort,
  GithubInstallationClaim,
} from '../../../infrastructure/github-app.port';
import { ConnectInstallationCommand } from '../connect-installation.command';
import { ConnectInstallationCommandHandler } from '../connect-installation.command-handler';

/**
 * Two things are asserted here, and they fail independently.
 *
 * The **claim proof**: `POST /installations` takes an installation id from the
 * caller's browser, so if the handler trusted it, anyone could post someone
 * else's number and receive one-hour write tokens for their repositories.
 *
 * And **which row the claim lands on**: a claim is something a workspace holds,
 * not something it once touched, so a live row elsewhere is a conflict while a
 * disconnected one is history.
 */

const CLAIM: GithubInstallationClaim = {
  githubInstallationId: 45678901,
  accountLogin: 'acme-labs',
  accountType: 'Organization',
  repositorySelection: 'selected',
  suspendedAt: null,
};

interface Rows {
  live?: GithubInstallationEntity;
  disconnected?: GithubInstallationEntity;
  visible?: { githubInstallationId: number }[];
  claim?: GithubInstallationClaim;
  insertFails?: AppError;
}

function build(rows: Rows = {}) {
  const installations = {
    insert: vi.fn().mockImplementation(() => {
      if (rows.insertFails) return Promise.reject(rows.insertFails);
      return Promise.resolve(undefined);
    }),
    save: vi.fn().mockImplementation((entity) => Promise.resolve(entity)),
    findLiveByGithubInstallationId: vi.fn().mockResolvedValue(rows.live ? Some(rows.live) : None),
    findDisconnectedForOrganization: vi
      .fn()
      .mockResolvedValue(rows.disconnected ? Some(rows.disconnected) : None),
  } satisfies Pick<
    GithubInstallationRepositoryPort,
    'insert' | 'save' | 'findLiveByGithubInstallationId' | 'findDisconnectedForOrganization'
  >;

  const github = {
    isConfigured: vi.fn().mockReturnValue(true),
    listUserInstallations: vi
      .fn()
      .mockResolvedValue(rows.visible ?? [{ githubInstallationId: CLAIM.githubInstallationId }]),
    readInstallation: vi.fn().mockResolvedValue(rows.claim ?? CLAIM),
  } satisfies Pick<GithubAppPort, 'isConfigured' | 'listUserInstallations' | 'readInstallation'>;

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

function connected(organizationId: string, suspendedAt: Date | null = null) {
  return GithubInstallationEntity.connect({
    organizationId,
    githubInstallationId: CLAIM.githubInstallationId,
    accountLogin: 'acme-labs',
    accountType: 'Organization',
    repositorySelection: 'all',
    installedByUserId: 'someone',
    suspendedAt,
  });
}

describe('the claim proof', () => {
  let subject: ReturnType<typeof build>;

  beforeEach(() => {
    subject = build();
  });

  it('records what GitHub says, not what the request body said', async () => {
    const id = await subject.handler.execute(command());

    expect(subject.github.listUserInstallations).toHaveBeenCalledWith('the-oauth-code');
    const [inserted] = subject.installations.insert.mock.calls[0] as [GithubInstallationEntity];
    expect(inserted.id).toBe(id);
    expect(inserted.organizationId).toBe('org-acme');
    // Only the id was ever the caller's to name; the rest is GitHub's answer.
    expect(inserted.accountLogin).toBe('acme-labs');
    expect(inserted.repositorySelection).toBe('selected');
  });

  it('refuses an installation GitHub does not list for the caller', async () => {
    const other = build({ visible: [{ githubInstallationId: 999 }] });

    await expect(other.handler.execute(command())).rejects.toMatchObject({ code: 'GITHUB_004' });
    expect(other.github.readInstallation).not.toHaveBeenCalled();
    expect(other.installations.insert).not.toHaveBeenCalled();
  });

  it('refuses when GitHub lists nothing at all for the caller', async () => {
    const empty = build({ visible: [] });

    await expect(empty.handler.execute(command())).rejects.toBeInstanceOf(AppError);
    expect(empty.installations.insert).not.toHaveBeenCalled();
  });

  it('carries GitHub’s current suspension onto a new row', async () => {
    const suspended = new Date('2026-09-19T09:00:00.000Z');
    const subject = build({ claim: { ...CLAIM, suspendedAt: suspended } });

    await subject.handler.execute(command());

    const [inserted] = subject.installations.insert.mock.calls[0] as [GithubInstallationEntity];
    expect(inserted.suspendedAt).toEqual(suspended);
    expect(inserted.isUsable).toBe(false);
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

describe('which row the claim lands on', () => {
  it('refuses an installation another workspace holds right now', async () => {
    const taken = build({ live: connected('org-rival') });

    await expect(taken.handler.execute(command())).rejects.toMatchObject({ code: 'GITHUB_003' });
    expect(taken.installations.save).not.toHaveBeenCalled();
    expect(taken.installations.insert).not.toHaveBeenCalled();
  });

  it('refreshes this workspace’s own live row instead of duplicating it', async () => {
    const existing = connected('org-acme');
    const subject = build({ live: existing });

    const id = await subject.handler.execute(command());

    expect(id).toBe(existing.id);
    expect(subject.installations.insert).not.toHaveBeenCalled();
    // Re-posting the redirect is how a changed repository selection reaches us.
    expect(existing.repositorySelection).toBe('selected');
    expect(existing.installedByUserId).toBe('ana');
  });

  it('revives this workspace’s own disconnected row', async () => {
    const existing = connected('org-acme');
    existing.disconnect();
    const subject = build({ disconnected: existing });

    const id = await subject.handler.execute(command());

    expect(id).toBe(existing.id);
    expect(existing.deletedAt).toBeNull();
    expect(subject.installations.insert).not.toHaveBeenCalled();
    expect(subject.installations.save).toHaveBeenCalledTimes(1);
  });

  it('never silently unsuspends on a reconnect', async () => {
    const existing = connected('org-acme');
    const stillSuspended = new Date('2026-09-19T09:00:00.000Z');
    const subject = build({
      live: existing,
      claim: { ...CLAIM, suspendedAt: stillSuspended },
    });

    await subject.handler.execute(command());

    // Otherwise re-posting the redirect would be a way to mark a suspended
    // installation usable here until the next webhook said otherwise.
    expect(existing.suspendedAt).toEqual(stillSuspended);
    expect(existing.isUsable).toBe(false);
  });

  it('claims an installation another workspace disconnected', async () => {
    // A claim is something a workspace holds. Once it is given up, the number is
    // free, and `GITHUB_003` would otherwise mean "someone once connected this".
    const subject = build({ disconnected: undefined, live: undefined });

    await expect(subject.handler.execute(command())).resolves.toBeTruthy();
    expect(subject.installations.insert).toHaveBeenCalledTimes(1);
  });

  it('reports the constraint’s refusal as the same 409, not a 500', async () => {
    // Two workspaces posting the same installation in the same moment both pass
    // the live-row check; the partial unique index is what actually decides.
    const raced = build({
      insertFails: new AppError(GithubErrors.INSTALLATION_ALREADY_CONNECTED),
    });

    await expect(raced.handler.execute(command())).rejects.toMatchObject({ code: 'GITHUB_003' });
  });
});
