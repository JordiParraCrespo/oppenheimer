import {
  defineAbilitiesFromPermissions,
  type PermissionDefinition,
  SYSTEM_ROLE_PERMISSIONS,
} from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRepositoryPort } from '../../../../users/database/user.repository.port';
import { UserErrors } from '../../../../users/domain/user.errors';
import type { AbilityFactory } from '../../../application/ability.factory';
import { RoleGrantPolicy } from '../../../application/role-grant.policy';
import type { RoleRepositoryPort } from '../../../database/role.repository.port';
import type { UserRoleRepositoryPort } from '../../../database/user-role.repository.port';
import { RoleEntity } from '../../../domain/role.entity';
import { RoleErrors } from '../../../domain/role.errors';
import { Permission } from '../../../domain/value-objects/permission.value-object';
import { AssignUserRolesCommand } from '../assign-user-roles.command';
import { AssignUserRolesCommandHandler } from '../assign-user-roles.command-handler';

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

describe('AssignUserRolesCommandHandler', () => {
  let service: AssignUserRolesCommandHandler;
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
      assignRoleToUser: vi.fn(),
      replaceMembershipRole: vi.fn(),
    };
    grantPolicy = {
      assertGrantable: vi.fn().mockResolvedValue(undefined),
    };
    service = new AssignUserRolesCommandHandler(
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
        organizationId: 'organization-1',
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
        organizationId: 'organization-1',
      }),
    );

    expect(grantPolicy.assertGrantable).toHaveBeenCalledWith(
      { id: 'actor-1', role: 'admin', organizationId: 'organization-1' },
      [permission.toDefinition()],
    );
  });

  describe('with the real grant policy', () => {
    /** The handler wired to a real `RoleGrantPolicy` over an actor holding `actorRules`. */
    function handlerFor(actorRules: PermissionDefinition[]): AssignUserRolesCommandHandler {
      const abilityFactory = {
        createForUser: vi.fn(async (user, scope) =>
          defineAbilitiesFromPermissions(actorRules, {
            user,
            activeOrganizationId: scope?.organizationId ?? null,
            activeTeamId: null,
          }),
        ),
      } as unknown as AbilityFactory;
      return new AssignUserRolesCommandHandler(
        userRepo as UserRepositoryPort,
        roleRepo as RoleRepositoryPort,
        userRoleRepo,
        new RoleGrantPolicy(abilityFactory),
      );
    }

    const assign = (handler: AssignUserRolesCommandHandler) =>
      handler.execute(
        new AssignUserRolesCommand({
          userId: 'user-1',
          roleIds: ['r1'],
          actorId: 'actor-1',
          organizationId: 'organization-1',
        }),
      );

    it('lets `manage all` assign the conditioned owner role', async () => {
      vi.mocked(roleRepo.findByIds).mockResolvedValue([
        makeRole(
          'r1',
          SYSTEM_ROLE_PERMISSIONS.owner.map((rule) => Permission.fromDefinition(rule)),
        ),
      ]);

      await assign(handlerFor([{ action: 'manage', subject: 'all' }]));

      expect(userRoleRepo.setRolesForUser).toHaveBeenCalledWith('user-1', ['r1'], 'organization-1');
    });

    it('stops an owner assigning a role wider than their organization', async () => {
      vi.mocked(roleRepo.findByIds).mockResolvedValue([
        makeRole('r1', [Permission.fromDefinition({ action: 'manage', subject: 'Session' })]),
      ]);

      await expect(assign(handlerFor(SYSTEM_ROLE_PERMISSIONS.owner))).rejects.toMatchObject({
        code: RoleErrors.PERMISSION_NOT_GRANTABLE.code,
      });
      expect(userRoleRepo.setRolesForUser).not.toHaveBeenCalled();
    });
  });
});
