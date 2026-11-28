import type { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GithubUserGrantResolver } from '../../../application/github-user-grant.resolver';
import {
  INSTALL_STATE_PREFIX,
  InstallStateResolver,
} from '../../../application/install-state.resolver';
import { InstallationClaimResolver } from '../../../application/installation-claim.resolver';
import type { GithubInstallationRepositoryPort } from '../../../database/github-installation.repository.port';
import { GithubErrors } from '../../../domain/github.errors';
import { GithubInstallationEntity } from '../../../domain/github-installation.entity';
import { GithubInstallationMapper } from '../../../github-installation.mapper';
import type {
  GithubAppPort,
  GithubInstallationClaim,
  GithubOrganizationMembership,
} from '../../../infrastructure/github-app.port';
import { ConnectInstallationCommand } from '../connect-installation.command';
import { ConnectInstallationCommandHandler } from '../connect-installation.command-handler';

/**
 * Three things are asserted here, and they fail independently: the install
 * state (without one this person minted, a half-finished callback URL would
 * connect someone's installation to whoever opened it); the claim proof (the
 * installation id comes from the browser, so trusting it would hand anyone
 * one-hour write tokens for another account's repositories); and which row the
 * claim lands on (see `ConnectInstallationCommandHandler`).
 *
 * The claim proof has two halves. GitHub lists an installation for anyone with
 * explicit access to one repository it covers, so seeing it proves nothing on
 * its own: the person must also be the account it is installed on, or an
 * active owner of that organization.
 */

/** Ana, as GitHub knows her: the account that authorizes every `build()`. */
const ANA_GITHUB_ID = 583231;

const CLAIM: GithubInstallationClaim = {
  githubInstallationId: 45678901,
  accountLogin: 'acme-labs',
  accountId: 91004417,
  accountType: 'Organization',
  repositorySelection: 'selected',
  suspendedAt: null,
};

/** The same installation on Ana's own personal account. */
const PERSONAL_CLAIM: GithubInstallationClaim = {
  ...CLAIM,
  accountLogin: 'ana',
  accountId: ANA_GITHUB_ID,
  accountType: 'User',
};

interface Rows {
  live?: GithubInstallationEntity;
  disconnected?: GithubInstallationEntity;
  visible?: { githubInstallationId: number }[];
  claim?: GithubInstallationClaim;
  /** Ana's membership of the installation's organization; `null` is GitHub refusing to say. */
  membership?: GithubOrganizationMembership | null;
  insertFails?: AppError;
}

/** A state minted for `ana` in `org-acme`, seeded into every `build()`. */
const STATE = 'the-install-state-nonce';

/** `setIfAbsent` / `take` over a Map: the two semantics the resolver relies on. */
function memoryCache() {
  const store = new Map<string, unknown>();
  return {
    store,
    setIfAbsent: vi.fn(async (key: string, value: unknown) => {
      if (store.has(key)) return false;
      store.set(key, value);
      return true;
    }),
    take: vi.fn(async (key: string) => {
      const value = store.get(key);
      store.delete(key);
      return value;
    }),
  };
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
    listUserInstallations: vi.fn().mockResolvedValue({
      installations: rows.visible ?? [{ githubInstallationId: CLAIM.githubInstallationId }],
      user: { githubUserId: ANA_GITHUB_ID, login: 'ana' },
      tokens: {
        accessToken: 'ghu_ana',
        accessExpiresAt: null,
        refreshToken: null,
        refreshExpiresAt: null,
      },
    }),
    readInstallation: vi.fn().mockResolvedValue(rows.claim ?? CLAIM),
    readOrganizationMembership: vi
      .fn()
      .mockResolvedValue(
        rows.membership === undefined ? { active: true, admin: true } : rows.membership,
      ),
  } satisfies Pick<
    GithubAppPort,
    'isConfigured' | 'listUserInstallations' | 'readInstallation' | 'readOrganizationMembership'
  >;

  const userGrants = { keep: vi.fn().mockResolvedValue(undefined) } satisfies Pick<
    GithubUserGrantResolver,
    'keep'
  >;

  const cache = memoryCache();
  cache.store.set(`${INSTALL_STATE_PREFIX}${STATE}`, { userId: 'ana', organizationId: 'org-acme' });
  const installState = new InstallStateResolver(cache as unknown as CacheService);

  const handler = new ConnectInstallationCommandHandler(
    installations as unknown as GithubInstallationRepositoryPort,
    new GithubInstallationMapper(),
    installState,
    new InstallationClaimResolver(
      github as unknown as GithubAppPort,
      userGrants as unknown as GithubUserGrantResolver,
    ),
  );

  return { handler, installations, github, cache, userGrants };
}

function command(overrides: Partial<ConnectInstallationCommand> = {}) {
  return new ConnectInstallationCommand({
    organizationId: 'org-acme',
    userId: 'ana',
    githubInstallationId: CLAIM.githubInstallationId,
    code: 'the-oauth-code',
    state: STATE,
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

describe('the install state', () => {
  it.each([
    // The regression: Mallory's stopped callback carries her code and no state
    // of Victor's, and used to connect her installation to his workspace.
    ['a state this console never minted', { state: 'never-minted-state-nonce' }],
    ['a state minted for someone else', { userId: 'mallory' }],
    ['a state minted in another workspace', { organizationId: 'org-rival' }],
  ])('refuses %s, before GitHub is called', async (_case, overrides) => {
    const subject = build();

    await expect(subject.handler.execute(command(overrides))).rejects.toMatchObject({
      code: 'GITHUB_011',
    });
    expect(subject.github.listUserInstallations).not.toHaveBeenCalled();
    expect(subject.installations.insert).not.toHaveBeenCalled();
  });

  it('spends the state: a second post with it is refused', async () => {
    const subject = build();

    await expect(subject.handler.execute(command())).resolves.toBeTruthy();
    await expect(subject.handler.execute(command())).rejects.toMatchObject({
      code: 'GITHUB_011',
    });
    expect(subject.github.listUserInstallations).toHaveBeenCalledTimes(1);
  });

  it('spends the state even when GitHub then refuses the claim', async () => {
    const subject = build({ visible: [] });

    await expect(subject.handler.execute(command())).rejects.toMatchObject({ code: 'GITHUB_004' });
    expect(subject.cache.store.size).toBe(0);
  });
});

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

describe('the claim proof: control of the installation’s account', () => {
  /** Each place a proven claim can land: a new row, a live row here, a disconnected row here. */
  const landings = (): [string, Pick<Rows, 'live' | 'disconnected'>][] => {
    const disconnected = connected('org-acme');
    disconnected.disconnect();
    return [
      ['a new connect', {}],
      ['a refresh of this workspace’s live row', { live: connected('org-acme') }],
      ['a reconnect of this workspace’s disconnected row', { disconnected }],
    ];
  };

  function expectNothingWritten(subject: ReturnType<typeof build>) {
    expect(subject.installations.insert).not.toHaveBeenCalled();
    expect(subject.installations.save).not.toHaveBeenCalled();
    expect(subject.userGrants.keep).not.toHaveBeenCalled();
  }

  describe.each(landings())('on %s', (_landing, rows) => {
    it('refuses a collaborator who sees someone else’s personal installation', async () => {
      // The regression: GitHub lists Bob's installation for Ana because she can
      // read one of his repositories, and the old proof stopped there.
      const subject = build({
        ...rows,
        claim: { ...PERSONAL_CLAIM, accountLogin: 'bob', accountId: 7730021 },
      });

      await expect(subject.handler.execute(command())).rejects.toMatchObject({
        code: 'GITHUB_004',
        detail: expect.stringContaining('bob'),
      });
      expect(subject.github.readOrganizationMembership).not.toHaveBeenCalled();
      expectNothingWritten(subject);
    });

    it('refuses a member of the organization who is not one of its owners', async () => {
      const subject = build({ ...rows, membership: { active: true, admin: false } });

      await expect(subject.handler.execute(command())).rejects.toMatchObject({
        code: 'GITHUB_004',
        detail: expect.stringContaining('acme-labs'),
      });
      expectNothingWritten(subject);
    });

    it('refuses an owner whose membership is still pending', async () => {
      const subject = build({ ...rows, membership: { active: false, admin: true } });

      await expect(subject.handler.execute(command())).rejects.toMatchObject({
        code: 'GITHUB_004',
      });
      expectNothingWritten(subject);
    });

    it('refuses when GitHub will not say (no membership, or the App lacks Members: read)', async () => {
      const subject = build({ ...rows, membership: null });

      await expect(subject.handler.execute(command())).rejects.toMatchObject({
        code: 'GITHUB_004',
        detail: expect.stringContaining('Members'),
      });
      expectNothingWritten(subject);
    });
  });

  it('accepts an active owner of the organization, asking about that organization with her token', async () => {
    const subject = build();

    await expect(subject.handler.execute(command())).resolves.toBeTruthy();
    expect(subject.github.readOrganizationMembership).toHaveBeenCalledWith(
      expect.objectContaining({ user: { githubUserId: ANA_GITHUB_ID, login: 'ana' } }),
      'acme-labs',
    );
    expect(subject.installations.insert).toHaveBeenCalledTimes(1);
    expect(subject.userGrants.keep).toHaveBeenCalledTimes(1);
  });

  it('accepts the personal account itself, without asking about an organization', async () => {
    const subject = build({ claim: PERSONAL_CLAIM, membership: null });

    await expect(subject.handler.execute(command())).resolves.toBeTruthy();
    expect(subject.github.readOrganizationMembership).not.toHaveBeenCalled();
    expect(subject.installations.insert).toHaveBeenCalledTimes(1);
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

  it('reports the constraint’s refusal as the same 409, not a 500', async () => {
    // Two workspaces posting the same installation in the same moment both pass
    // the live-row check; the partial unique index is what actually decides.
    const raced = build({
      insertFails: new AppError(GithubErrors.INSTALLATION_ALREADY_CONNECTED),
    });

    await expect(raced.handler.execute(command())).rejects.toMatchObject({ code: 'GITHUB_003' });
  });
});
