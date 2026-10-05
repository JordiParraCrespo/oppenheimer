import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleGrantPolicy } from '../../../application/role-grant.policy';
import type { RoleRepositoryPort } from '../../../database/role.repository.port';
import { RoleEntity } from '../../../domain/role.entity';
import { RoleErrors } from '../../../domain/role.errors';
import { Permission } from '../../../domain/value-objects/permission.value-object';
import { UpdateRolePermissionsCommand } from '../update-role-permissions.command';
import { UpdateRolePermissionsCommandHandler } from '../update-role-permissions.command-handler';

const MANAGE_ALL = { action: 'manage', subject: 'all' } as const;

function makeRole({
  isSystem = false,
  permissions = [],
}: {
  isSystem?: boolean;
  permissions?: Permission[];
} = {}): RoleEntity {
  return RoleEntity.create({
    id: 'role-1',
    props: {
      name: 'admin',
      description: null,
      isSystem,
      organizationId: null,
      permissions,
    },
  });
}

describe('UpdateRolePermissionsCommandHandler', () => {
  let service: UpdateRolePermissionsCommandHandler;
  let repo: Pick<RoleRepositoryPort, 'findOneById' | 'save'>;
  let policy: {
    assertGrantable: ReturnType<typeof vi.fn>;
    assertCanModify: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    repo = {
      findOneById: vi.fn().mockResolvedValue(Some(makeRole())),
      save: vi.fn().mockResolvedValue(undefined),
    };
    policy = {
      assertGrantable: vi.fn().mockResolvedValue(undefined),
      assertCanModify: vi.fn().mockResolvedValue(undefined),
    };
    service = new UpdateRolePermissionsCommandHandler(
      repo as RoleRepositoryPort,
      policy as unknown as RoleGrantPolicy,
    );
  });

  const ACTOR = { id: 'actor-1', role: undefined, organizationId: 'org-1' };

  function execute() {
    return service.execute(
      new UpdateRolePermissionsCommand({
        roleId: 'role-1',
        permissions: [MANAGE_ALL],
        actorId: 'actor-1',
        organizationId: 'org-1',
      }),
    );
  }

  // No privilege escalation: the author must hold every permission they put on
  // the role, so the policy is asked about the command's permissions.
  it('saves nothing when the actor cannot grant the permissions (ROLE_005)', async () => {
    policy.assertGrantable.mockRejectedValue(new AppError(RoleErrors.PERMISSION_NOT_GRANTABLE));

    await expect(execute()).rejects.toMatchObject({
      code: RoleErrors.PERMISSION_NOT_GRANTABLE.code,
    });
    expect(policy.assertGrantable).toHaveBeenCalledWith(ACTOR, [MANAGE_ALL]);
    expect(repo.save).not.toHaveBeenCalled();
  });

  // No writing another tenant's or the platform's role: the policy is asked
  // about the role that was loaded, not the permissions.
  it('saves nothing when the actor cannot modify the loaded role (ROLE_006)', async () => {
    policy.assertCanModify.mockRejectedValue(new AppError(RoleErrors.CROSS_ORGANIZATION_ROLE));

    await expect(execute()).rejects.toMatchObject({
      code: RoleErrors.CROSS_ORGANIZATION_ROLE.code,
    });
    expect(policy.assertCanModify).toHaveBeenCalledWith(
      ACTOR,
      expect.objectContaining({ id: 'role-1' }),
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('replaces the permission set on a custom role and returns its id', async () => {
    const role = makeRole();
    vi.mocked(repo.findOneById).mockResolvedValue(Some(role));

    const id = await service.execute(
      new UpdateRolePermissionsCommand({
        roleId: 'role-1',
        permissions: [
          { action: 'read', subject: 'Article' },
          { action: 'update', subject: 'Article' },
        ],
      }),
    );

    expect(id).toBe('role-1');
    expect(role.permissions).toHaveLength(2);
    expect(repo.save).toHaveBeenCalledWith(role);
  });

  it('throws NOT_FOUND when the role does not exist', async () => {
    vi.mocked(repo.findOneById).mockResolvedValue(None);

    await expect(
      service.execute(
        new UpdateRolePermissionsCommand({
          roleId: 'missing',
          permissions: [],
        }),
      ),
    ).rejects.toMatchObject({ code: RoleErrors.NOT_FOUND.code });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('throws ADMIN_LOCKOUT when stripping "manage all" from a full-access system role', async () => {
    const adminRole = makeRole({
      isSystem: true,
      permissions: [Permission.fromDefinition(MANAGE_ALL)],
    });
    vi.mocked(repo.findOneById).mockResolvedValue(Some(adminRole));

    await expect(
      service.execute(
        new UpdateRolePermissionsCommand({
          roleId: 'role-1',
          permissions: [{ action: 'read', subject: 'Article' }],
        }),
      ),
    ).rejects.toMatchObject({ code: RoleErrors.ADMIN_LOCKOUT.code });
    expect(adminRole.hasFullAccess()).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('keeps a full-access system role editable while "manage all" is retained', async () => {
    const adminRole = makeRole({
      isSystem: true,
      permissions: [Permission.fromDefinition(MANAGE_ALL)],
    });
    vi.mocked(repo.findOneById).mockResolvedValue(Some(adminRole));

    await service.execute(
      new UpdateRolePermissionsCommand({
        roleId: 'role-1',
        permissions: [MANAGE_ALL, { action: 'read', subject: 'Article' }],
      }),
    );

    expect(adminRole.permissions).toHaveLength(2);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('lets a non-system role drop "manage all" without triggering the lockout guard', async () => {
    const customRole = makeRole({
      isSystem: false,
      permissions: [Permission.fromDefinition(MANAGE_ALL)],
    });
    vi.mocked(repo.findOneById).mockResolvedValue(Some(customRole));

    await service.execute(
      new UpdateRolePermissionsCommand({
        roleId: 'role-1',
        permissions: [{ action: 'read', subject: 'Article' }],
      }),
    );

    expect(customRole.hasFullAccess()).toBe(false);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});
