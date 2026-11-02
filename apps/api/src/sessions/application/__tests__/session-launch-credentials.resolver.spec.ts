import { describe, expect, it, vi } from 'vitest';
import { SessionCheckoutEntity } from '../../domain/session-checkout.entity';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import type { RepositoryTokenFactory } from '../repository-token.factory';
import { SessionLaunchCredentials } from '../session-launch-credentials.resolver';

/**
 * A cloud session leaves no checkout on its host for git to ask a token by, so
 * its launch carries one; every other place carries nothing.
 */
function session(place: 'worktree' | 'cloud') {
  const work = WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
    place,
  });
  work.attachCheckout(
    SessionCheckoutEntity.createNew({
      organizationId: work.organizationId,
      sessionId: work.id,
      installationId: 'installation-1',
      githubRepoId: '42',
      repositoryFullName: 'acme/xrp-mobile',
      directoryName: 'xrp-mobile',
      baseBranch: 'main',
      branch: 'oppenheimer/bold-otter-3f9a7k',
    }),
  );
  return work;
}

const TOKEN = { sealed: 'c2VhbGVk', expiresAt: new Date('2026-10-27T12:00:00Z') };

describe('SessionLaunchCredentials', () => {
  it('seals the cloud session’s one repository to its host', async () => {
    const seal = vi.fn().mockResolvedValue(TOKEN);
    const credentials = new SessionLaunchCredentials({
      sealed: seal,
    } as unknown as RepositoryTokenFactory);

    await expect(credentials.for(session('cloud'))).resolves.toEqual({ cloud: TOKEN });
    expect(seal).toHaveBeenCalledWith('host-1', 'installation-1', 42);
  });

  it('holds a cloud launch back while the host has no key to seal to', async () => {
    const credentials = new SessionLaunchCredentials({
      sealed: vi.fn().mockResolvedValue(null),
    } as unknown as RepositoryTokenFactory);

    await expect(credentials.for(session('cloud'))).resolves.toEqual({ withheld: 'host_offline' });
  });

  it('asks nothing for a worktree session: its git asks by its live checkout', async () => {
    const seal = vi.fn();
    const credentials = new SessionLaunchCredentials({
      sealed: seal,
    } as unknown as RepositoryTokenFactory);

    await expect(credentials.for(session('worktree'))).resolves.toEqual({});
    expect(seal).not.toHaveBeenCalled();
  });
});
