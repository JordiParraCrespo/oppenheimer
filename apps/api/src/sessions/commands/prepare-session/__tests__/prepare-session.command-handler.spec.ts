import { describe, expect, it, vi } from 'vitest';
import type { RepositoryAccessPort } from '../../../../github/application/repository-access.port';
import type { HostAccessPort } from '../../../../hosts/application/host-access.port';
import type { HostKeyPort } from '../../../../hosts/application/host-key.port';
import type { SessionDispatchPort } from '../../../application/session-dispatch.port';
import { PrepareSessionCommand } from '../prepare-session.command';
import { PrepareSessionCommandHandler } from '../prepare-session.command-handler';

/**
 * Whose stores a prepare warms: the runner keeps them under the account it is
 * paired with and the workspace the session will be in
 * (`product/versions/mvp/24-session-places.md` §2), so both ride the frame —
 * the host's owner, not the caller, who may be using a host shared with them.
 */

const SCOPE = {
  userId: 'caller-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function harness() {
  const hosts: HostAccessPort = {
    assertUsable: vi.fn().mockResolvedValue({ probedTools: null }),
  };
  const keys: HostKeyPort = {
    publicKeyOf: vi.fn().mockResolvedValue('key'),
    sealFor: vi.fn().mockResolvedValue('c2VhbGVk'),
  };
  const repositories: Pick<RepositoryAccessPort, 'repositoryOf' | 'mintRepositoryToken'> = {
    repositoryOf: vi.fn().mockResolvedValue({ fullName: 'acme/xrp-mobile', defaultBranch: 'main' }),
    mintRepositoryToken: vi
      .fn()
      .mockResolvedValue({ token: 't', expiresAt: new Date('2026-10-14T12:00:00Z') }),
  };
  const dispatch: Pick<SessionDispatchPort, 'prepareRefusal' | 'prepare'> = {
    prepareRefusal: vi.fn().mockReturnValue(null),
    prepare: vi.fn().mockReturnValue({ delivered: true, hints: [] }),
  };
  const handler = new PrepareSessionCommandHandler(
    hosts,
    keys,
    repositories as RepositoryAccessPort,
    dispatch as SessionDispatchPort,
  );
  return { dispatch, handler };
}

const command = (scope = SCOPE) =>
  new PrepareSessionCommand({
    scope,
    input: {
      hostId: 'host-1',
      checkouts: [{ installationId: 'installation-1', githubRepoId: 42 }],
    },
  });

describe('PrepareSessionCommandHandler', () => {
  it('names the caller’s workspace on what it sends, and no account: that is the pairing’s', async () => {
    const h = harness();

    await expect(h.handler.execute(command())).resolves.toEqual({ hints: [] });

    expect(h.dispatch.prepare).toHaveBeenCalledWith(
      'host-1',
      expect.objectContaining({
        workspaceId: 'org-acme',
        githubRepoId: 42,
        baseBranch: 'main',
      }),
    );
  });

  it('refuses a caller with no active workspace with SESSIONS_002, and sends nothing', async () => {
    const h = harness();

    await expect(
      h.handler.execute(command({ ...SCOPE, organizationId: null as unknown as string })),
    ).rejects.toMatchObject({ code: 'SESSIONS_002' });
    expect(h.dispatch.prepare).not.toHaveBeenCalled();
  });
});
