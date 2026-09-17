import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleRepositoryPort } from '../../../../roles/database/role.repository.port';
import type { PersonalWorkspaceRepositoryPort } from '../../../database/personal-workspace.repository.port';
import type { PersonalWorkspaceEntity } from '../../../domain/personal-workspace.entity';
import { ProvisionPersonalWorkspaceCommand } from '../provision-personal-workspace.command';
import { ProvisionPersonalWorkspaceService } from '../provision-personal-workspace.service';

const command = new ProvisionPersonalWorkspaceCommand({
  userId: 'user-uuid',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
});

describe('ProvisionPersonalWorkspaceService', () => {
  let service: ProvisionPersonalWorkspaceService;
  let workspaces: PersonalWorkspaceRepositoryPort;
  let roles: Pick<RoleRepositoryPort, 'findOneByName'>;

  beforeEach(() => {
    workspaces = {
      belongsToAnyOrganization: vi.fn().mockResolvedValue(false),
      insert: vi.fn().mockResolvedValue(undefined),
    };
    roles = {
      findOneByName: vi.fn().mockResolvedValue(Some({ id: 'owner-role-uuid' })),
    };
    service = new ProvisionPersonalWorkspaceService(
      workspaces,
      roles as unknown as RoleRepositoryPort,
    );
  });

  it('writes the organization, the owner membership and the role grant as one aggregate', async () => {
    const organizationId = await service.execute(command);

    expect(workspaces.insert).toHaveBeenCalledTimes(1);
    const written = vi.mocked(workspaces.insert).mock.calls[0][0] as PersonalWorkspaceEntity;
    expect(written.id).toBe(organizationId);
    expect(written.ownerId).toBe('user-uuid');
    expect(written.name).toBe('Ada Lovelace');
    expect(written.ownerRoleId).toBe('owner-role-uuid');
    // The event the outbox stages inside the same transaction as the write.
    expect(written.domainEvents).toHaveLength(1);
  });

  it('grants the global `owner` system role, not one scoped to a tenant', async () => {
    await service.execute(command);

    expect(roles.findOneByName).toHaveBeenCalledWith('owner', null);
  });

  it('leaves an account that already belongs to an organization alone', async () => {
    vi.mocked(workspaces.belongsToAnyOrganization).mockResolvedValue(true);

    // `null`, not a throw: "already had one" is a success for every caller, and
    // both the sign-up hook and the seed provision the same account.
    await expect(service.execute(command)).resolves.toBeNull();
    expect(workspaces.insert).not.toHaveBeenCalled();
  });

  it('refuses to create a workspace nobody could open', async () => {
    vi.mocked(roles.findOneByName).mockResolvedValue(None);

    // The migration installs the `owner` role, so its absence means the
    // database is behind the code — better to write nothing than an
    // organization its owner is refused from.
    await expect(service.execute(command)).rejects.toBeInstanceOf(AppError);
    expect(workspaces.insert).not.toHaveBeenCalled();
  });
});
