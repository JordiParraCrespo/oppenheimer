import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleGrantPolicy } from '../../../application/role-grant.policy';
import type { RoleRepositoryPort } from '../../../database/role.repository.port';
import { RoleEntity } from '../../../domain/role.entity';
import { RoleErrors } from '../../../domain/role.errors';
import { CreateRoleCommand } from '../create-role.command';
import { CreateRoleCommandHandler } from '../create-role.command-handler';

describe('CreateRoleCommandHandler', () => {
  let service: CreateRoleCommandHandler;
  let repo: Pick<RoleRepositoryPort, 'findOneByName' | 'insert'>;

  beforeEach(() => {
    repo = {
      findOneByName: vi.fn().mockResolvedValue(None),
      insert: vi.fn().mockResolvedValue(undefined),
    };
    service = new CreateRoleCommandHandler(
      repo as RoleRepositoryPort,
      { assertGrantable: vi.fn().mockResolvedValue(undefined) } as unknown as RoleGrantPolicy,
    );
  });

  it('creates a non-system role with its permissions', async () => {
    await service.execute(
      new CreateRoleCommand({
        name: 'editor',
        description: 'Can edit articles',
        permissions: [{ action: 'update', subject: 'Article' }],
      }),
    );

    expect(repo.insert).toHaveBeenCalledTimes(1);
    const created = vi.mocked(repo.insert).mock.calls[0][0] as RoleEntity;
    expect(created.name).toBe('editor');
    expect(created.isSystem).toBe(false);
    expect(created.permissions).toHaveLength(1);
  });

  it('throws NAME_TAKEN when a role with the same name exists', async () => {
    vi.mocked(repo.findOneByName).mockResolvedValue(
      Some(
        RoleEntity.create({
          id: 'role-1',
          props: {
            name: 'editor',
            description: null,
            isSystem: false,
            organizationId: null,
            permissions: [],
          },
        }),
      ),
    );

    await expect(
      service.execute(new CreateRoleCommand({ name: 'editor', permissions: [] })),
    ).rejects.toMatchObject({ code: RoleErrors.NAME_TAKEN.code });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('creates and checks custom roles inside the active organization', async () => {
    await service.execute(
      new CreateRoleCommand({
        name: 'Content Lead',
        permissions: [],
        activeOrganizationId: 'organization-1',
      }),
    );

    expect(repo.findOneByName).toHaveBeenCalledWith('Content Lead', 'organization-1');
    const created = vi.mocked(repo.insert).mock.calls[0][0] as RoleEntity;
    expect(created.organizationId).toBe('organization-1');
  });
});
