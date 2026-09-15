import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleRepositoryPort } from '../../../database/role.repository.port';
import { RoleEntity } from '../../../domain/role.entity';
import { RoleErrors } from '../../../domain/role.errors';
import { Permission } from '../../../domain/value-objects/permission.value-object';
import type { RoleGrantPolicy } from '../../../services/role-grant.policy';
import { UpdateRolePermissionsCommand } from '../update-role-permissions.command';
import { UpdateRolePermissionsService } from '../update-role-permissions.service';

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

describe('UpdateRolePermissionsService', () => {
  let service: UpdateRolePermissionsService;
  let repo: Pick<RoleRepositoryPort, 'findOneById' | 'save'>;

  beforeEach(() => {
    repo = {
      findOneById: vi.fn().mockResolvedValue(Some(makeRole())),
      save: vi.fn().mockResolvedValue(undefined),
    };
    service = new UpdateRolePermissionsService(
      repo as RoleRepositoryPort,
      {
        assertGrantable: vi.fn().mockResolvedValue(undefined),
        assertCanModify: vi.fn().mockResolvedValue(undefined),
      } as unknown as RoleGrantPolicy,
    );
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
