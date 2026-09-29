import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleGrantPolicy } from '../../../application/role-grant.policy';
import type { RoleRepositoryPort } from '../../../database/role.repository.port';
import { RoleEntity } from '../../../domain/role.entity';
import { RoleErrors } from '../../../domain/role.errors';
import { Permission } from '../../../domain/value-objects/permission.value-object';
import { UpdateRoleCommand } from '../update-role.command';
import { UpdateRoleCommandHandler } from '../update-role.command-handler';

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
      description: 'Full access',
      isSystem,
      organizationId: null,
      permissions,
    },
  });
}

describe('UpdateRoleCommandHandler', () => {
  let service: UpdateRoleCommandHandler;
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
    service = new UpdateRoleCommandHandler(
      repo as RoleRepositoryPort,
      policy as unknown as RoleGrantPolicy,
    );
  });

  // No privilege escalation (ROLE_005) and no writing another tenant's or the
  // platform's role (ROLE_006): either refusal leaves the role unsaved.
  it.each([
    ['assertGrantable', RoleErrors.PERMISSION_NOT_GRANTABLE.code],
    ['assertCanModify', RoleErrors.CROSS_ORGANIZATION_ROLE.code],
  ] as const)('saves nothing when %s refuses the actor', async (check, code) => {
    policy[check].mockRejectedValue(Object.assign(new Error('refused'), { code }));

    await expect(
      service.execute(
        new UpdateRoleCommand({
          roleId: 'role-1',
          permissions: [MANAGE_ALL],
          actorId: 'actor-1',
          organizationId: 'org-1',
        }),
      ),
    ).rejects.toMatchObject({ code });
    expect(policy[check]).toHaveBeenCalledWith(
      { id: 'actor-1', role: undefined, organizationId: 'org-1' },
      expect.anything(),
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('updates the description and persists the role', async () => {
    const role = makeRole();
    vi.mocked(repo.findOneById).mockResolvedValue(Some(role));

    const id = await service.execute(
      new UpdateRoleCommand({ roleId: 'role-1', description: 'Updated' }),
    );

    expect(id).toBe('role-1');
    expect(role.description).toBe('Updated');
    expect(repo.save).toHaveBeenCalledWith(role);
  });

  it('replaces the permission set when permissions are provided', async () => {
    const role = makeRole();
    vi.mocked(repo.findOneById).mockResolvedValue(Some(role));

    await service.execute(
      new UpdateRoleCommand({
        roleId: 'role-1',
        permissions: [{ action: 'read', subject: 'Article' }],
      }),
    );

    expect(role.permissions).toHaveLength(1);
    expect(role.permissions[0]?.action).toBe('read');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('throws NOT_FOUND when the role does not exist', async () => {
    vi.mocked(repo.findOneById).mockResolvedValue(None);

    await expect(
      service.execute(new UpdateRoleCommand({ roleId: 'missing', description: 'x' })),
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
        new UpdateRoleCommand({
          roleId: 'role-1',
          permissions: [{ action: 'read', subject: 'Article' }],
        }),
      ),
    ).rejects.toMatchObject({ code: RoleErrors.ADMIN_LOCKOUT.code });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('allows updating a full-access system role as long as "manage all" is retained', async () => {
    const adminRole = makeRole({
      isSystem: true,
      permissions: [Permission.fromDefinition(MANAGE_ALL)],
    });
    vi.mocked(repo.findOneById).mockResolvedValue(Some(adminRole));

    await service.execute(
      new UpdateRoleCommand({
        roleId: 'role-1',
        permissions: [MANAGE_ALL, { action: 'read', subject: 'Article' }],
      }),
    );

    expect(adminRole.hasFullAccess()).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('lets a non-system role drop full access without triggering the lockout guard', async () => {
    const customRole = makeRole({
      isSystem: false,
      permissions: [Permission.fromDefinition(MANAGE_ALL)],
    });
    vi.mocked(repo.findOneById).mockResolvedValue(Some(customRole));

    await service.execute(
      new UpdateRoleCommand({
        roleId: 'role-1',
        permissions: [{ action: 'read', subject: 'Article' }],
      }),
    );

    expect(customRole.hasFullAccess()).toBe(false);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});
