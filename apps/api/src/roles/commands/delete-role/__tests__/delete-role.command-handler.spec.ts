import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleGrantPolicy } from '../../../application/role-grant.policy';
import type { RoleRepositoryPort } from '../../../database/role.repository.port';
import { RoleEntity } from '../../../domain/role.entity';
import { RoleErrors } from '../../../domain/role.errors';
import { DeleteRoleCommand } from '../delete-role.command';
import { DeleteRoleCommandHandler } from '../delete-role.command-handler';

function makeRole(isSystem: boolean): RoleEntity {
  return RoleEntity.create({
    id: 'role-1',
    props: {
      name: 'editor',
      description: null,
      isSystem,
      organizationId: null,
      permissions: [],
    },
  });
}

describe('DeleteRoleCommandHandler', () => {
  let service: DeleteRoleCommandHandler;
  let repo: Pick<RoleRepositoryPort, 'findOneById' | 'delete'>;

  beforeEach(() => {
    repo = {
      findOneById: vi.fn().mockResolvedValue(Some(makeRole(false))),
      delete: vi.fn().mockResolvedValue(true),
    };
    service = new DeleteRoleCommandHandler(
      repo as RoleRepositoryPort,
      {
        assertCanModify: vi.fn().mockResolvedValue(undefined),
      } as unknown as RoleGrantPolicy,
    );
  });

  it('deletes a custom role and raises the deletion event', async () => {
    await service.execute(new DeleteRoleCommand({ roleId: 'role-1' }));

    expect(repo.delete).toHaveBeenCalledTimes(1);
    const deleted = vi.mocked(repo.delete).mock.calls[0][0] as RoleEntity;
    expect(deleted.domainEvents).toHaveLength(1);
  });

  it('throws NOT_FOUND when the role does not exist', async () => {
    vi.mocked(repo.findOneById).mockResolvedValue(None);

    await expect(
      service.execute(new DeleteRoleCommand({ roleId: 'missing' })),
    ).rejects.toMatchObject({ code: RoleErrors.NOT_FOUND.code });
  });

  it('refuses to delete a system role', async () => {
    vi.mocked(repo.findOneById).mockResolvedValue(Some(makeRole(true)));

    await expect(
      service.execute(new DeleteRoleCommand({ roleId: 'role-1' })),
    ).rejects.toMatchObject({ code: RoleErrors.SYSTEM_ROLE_IMMUTABLE.code });
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
