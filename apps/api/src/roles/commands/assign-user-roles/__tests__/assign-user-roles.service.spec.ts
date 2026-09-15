import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRepositoryPort } from '../../../../users/database/user.repository.port';
import { UserErrors } from '../../../../users/domain/user.errors';
import type { RoleRepositoryPort } from '../../../database/role.repository.port';
import type { UserRoleRepositoryPort } from '../../../database/user-role.repository.port';
import { RoleEntity } from '../../../domain/role.entity';
import { RoleErrors } from '../../../domain/role.errors';
import { Permission } from '../../../domain/value-objects/permission.value-object';
import type { RoleGrantPolicy } from '../../../services/role-grant.policy';
import { AssignUserRolesCommand } from '../assign-user-roles.command';
import { AssignUserRolesService } from '../assign-user-roles.service';

function makeRole(id: string, permissions: Permission[] = []): RoleEntity {
  return RoleEntity.create({
    id,
    props: {
      name: `role-${id}`,
      description: null,
      isSystem: false,
      organizationId: null,
      permissions,
    },
  });
}

describe('AssignUserRolesService', () => {
  let service: AssignUserRolesService;
  let userRepo: Pick<UserRepositoryPort, 'findOneById'>;
  let roleRepo: Pick<RoleRepositoryPort, 'findByIds'>;
  let userRoleRepo: UserRoleRepositoryPort;
  let grantPolicy: Pick<RoleGrantPolicy, 'assertGrantable'>;

  beforeEach(() => {
    userRepo = {
      findOneById: vi.fn().mockResolvedValue(Some({ id: 'user-1' })),
    };
    roleRepo = {
      findByIds: vi.fn().mockResolvedValue([makeRole('r1'), makeRole('r2')]),
    };
    userRoleRepo = {
      findRoleIdsForUser: vi.fn(),
      findRolesForUser: vi.fn(),
      setRolesForUser: vi.fn().mockResolvedValue(undefined),
    };
    grantPolicy = {
      assertGrantable: vi.fn().mockResolvedValue(undefined),
    };
    service = new AssignUserRolesService(
      userRepo as UserRepositoryPort,
      roleRepo as RoleRepositoryPort,
      userRoleRepo,
      grantPolicy as RoleGrantPolicy,
    );
  });

  it('replaces the user role assignments with the referenced roles', async () => {
    await service.execute(new AssignUserRolesCommand({ userId: 'user-1', roleIds: ['r1', 'r2'] }));

    expect(userRoleRepo.setRolesForUser).toHaveBeenCalledWith('user-1', ['r1', 'r2']);
  });

  it('throws USER NOT_FOUND when the user does not exist', async () => {
    vi.mocked(userRepo.findOneById).mockResolvedValue(None);

    await expect(
      service.execute(new AssignUserRolesCommand({ userId: 'missing', roleIds: ['r1'] })),
    ).rejects.toMatchObject({ code: UserErrors.NOT_FOUND.code });
    expect(roleRepo.findByIds).not.toHaveBeenCalled();
    expect(userRoleRepo.setRolesForUser).not.toHaveBeenCalled();
  });

  it('throws ROLE NOT_FOUND when a referenced role does not resolve', async () => {
    vi.mocked(roleRepo.findByIds).mockResolvedValue([makeRole('r1')]);

    await expect(
      service.execute(
        new AssignUserRolesCommand({
          userId: 'user-1',
          roleIds: ['r1', 'missing'],
        }),
      ),
    ).rejects.toMatchObject({ code: RoleErrors.NOT_FOUND.code });
    expect(userRoleRepo.setRolesForUser).not.toHaveBeenCalled();
  });

  it('deduplicates role ids before validating and writing the join', async () => {
    vi.mocked(roleRepo.findByIds).mockResolvedValue([makeRole('r1')]);

    await service.execute(new AssignUserRolesCommand({ userId: 'user-1', roleIds: ['r1', 'r1'] }));

    expect(roleRepo.findByIds).toHaveBeenCalledWith(['r1']);
    expect(userRoleRepo.setRolesForUser).toHaveBeenCalledWith('user-1', ['r1']);
  });

  it('limits role validation and replacement to the active organization', async () => {
    await service.execute(
      new AssignUserRolesCommand({
        userId: 'user-1',
        roleIds: ['r1', 'r2'],
        activeOrganizationId: 'organization-1',
      }),
    );

    expect(roleRepo.findByIds).toHaveBeenCalledWith(['r1', 'r2'], 'organization-1');
    expect(userRoleRepo.setRolesForUser).toHaveBeenCalledWith(
      'user-1',
      ['r1', 'r2'],
      'organization-1',
    );
  });

  it('checks every assigned role permission against the actor before writing', async () => {
    const permission = Permission.fromDefinition({
      action: 'manage',
      subject: 'all',
    });
    vi.mocked(roleRepo.findByIds).mockResolvedValue([makeRole('r1', [permission])]);

    await service.execute(
      new AssignUserRolesCommand({
        userId: 'user-1',
        roleIds: ['r1'],
        actorId: 'actor-1',
        actorRole: 'admin',
        activeOrganizationId: 'organization-1',
      }),
    );

    expect(grantPolicy.assertGrantable).toHaveBeenCalledWith(
      { id: 'actor-1', role: 'admin', activeOrganizationId: 'organization-1' },
      [permission.toDefinition()],
    );
  });

  it('does not write the join when the actor cannot grant the assigned roles', async () => {
    const permission = Permission.fromDefinition({
      action: 'manage',
      subject: 'all',
    });
    vi.mocked(roleRepo.findByIds).mockResolvedValue([makeRole('r1', [permission])]);
    vi.mocked(grantPolicy.assertGrantable).mockRejectedValue(
      new AppError(RoleErrors.PERMISSION_NOT_GRANTABLE),
    );

    await expect(
      service.execute(
        new AssignUserRolesCommand({
          userId: 'user-1',
          roleIds: ['r1'],
          actorId: 'actor-1',
          actorRole: 'user',
        }),
      ),
    ).rejects.toMatchObject({ code: RoleErrors.PERMISSION_NOT_GRANTABLE.code });
    expect(userRoleRepo.setRolesForUser).not.toHaveBeenCalled();
  });
});
