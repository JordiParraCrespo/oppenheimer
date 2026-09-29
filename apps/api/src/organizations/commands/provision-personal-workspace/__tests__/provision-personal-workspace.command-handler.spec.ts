import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionCachePort } from '../../../../auth/application/session-cache.port';
import type { RoleRepositoryPort } from '../../../../roles/database/role.repository.port';
import { RoleErrors } from '../../../../roles/domain/role.errors';
import type { PersonalWorkspaceRepositoryPort } from '../../../database/personal-workspace.repository.port';
import type { PersonalWorkspaceEntity } from '../../../domain/personal-workspace.entity';
import { ProvisionPersonalWorkspaceCommand } from '../provision-personal-workspace.command';
import { ProvisionPersonalWorkspaceCommandHandler } from '../provision-personal-workspace.command-handler';

const command = new ProvisionPersonalWorkspaceCommand({
  userId: 'user-uuid',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
});

describe('ProvisionPersonalWorkspaceCommandHandler', () => {
  let service: ProvisionPersonalWorkspaceCommandHandler;
  let workspaces: PersonalWorkspaceRepositoryPort;
  let roles: Pick<RoleRepositoryPort, 'findOneByName'>;
  let sessionCache: SessionCachePort;

  /** The aggregate handed to the repository by the last call. */
  const written = () => vi.mocked(workspaces.provision).mock.calls[0][0] as PersonalWorkspaceEntity;

  beforeEach(() => {
    workspaces = { provision: vi.fn().mockResolvedValue(true), erase: vi.fn() };
    roles = { findOneByName: vi.fn().mockResolvedValue(Some({ id: 'owner-role-uuid' })) };
    sessionCache = {
      refreshUser: vi.fn().mockResolvedValue(undefined),
      evictUser: vi.fn(),
      revokeOtherSessions: vi.fn(),
    };
    service = new ProvisionPersonalWorkspaceCommandHandler(
      workspaces,
      roles as unknown as RoleRepositoryPort,
      sessionCache,
    );
  });

  it('hands the repository every row the workspace is made of', async () => {
    const organizationId = await service.execute(command);

    const workspace = written();
    expect(workspace.id).toBe(organizationId);
    // The organization.
    expect(workspace.name).toBe('Ada Lovelace');
    expect(workspace.slug.value).toMatch(/^ada-lovelace-[0-9a-f]{8}$/);
    // The membership, with an identity of its own.
    expect(workspace.ownerId).toBe('user-uuid');
    expect(workspace.membershipId).toBeTruthy();
    expect(workspace.membershipId).not.toBe(workspace.id);
    // The grant without which the owner cannot open it.
    expect(workspace.ownerRoleId).toBe('owner-role-uuid');
    // Staged on the outbox by the repository, inside the same transaction.
    expect(workspace.domainEvents).toHaveLength(1);
  });

  it('brings the cached sessions in line once the workspace is written', async () => {
    // The repository repoints the account's session rows at the workspace;
    // without the refresh the cached copies Better Auth reads would still name
    // no organization, and every org-scoped route would answer 403.
    await service.execute(command);

    expect(sessionCache.refreshUser).toHaveBeenCalledWith('user-uuid');
  });

  it('answers null, and leaves the cached sessions alone, when the repository declined to write', async () => {
    vi.mocked(workspaces.provision).mockResolvedValue(false);

    // "Already had one" is a success for every caller: sign-up and the seed
    // both provision the same account, and the seed is the repair path.
    await expect(service.execute(command)).resolves.toBeNull();
    expect(sessionCache.refreshUser).not.toHaveBeenCalled();
  });

  it('grants the global `owner` system role, not one scoped to a tenant', async () => {
    await service.execute(command);

    expect(roles.findOneByName).toHaveBeenCalledWith('owner', null);
  });

  it('refuses to create a workspace nobody could open', async () => {
    vi.mocked(roles.findOneByName).mockResolvedValue(None);

    // The migration installs the `owner` role, so its absence means the
    // database is behind the code — better to write nothing than an
    // organization its owner is refused from.
    const error = await service.execute(command).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(RoleErrors.SYSTEM_ROLE_MISSING.code);
    expect(workspaces.provision).not.toHaveBeenCalled();
  });
});
