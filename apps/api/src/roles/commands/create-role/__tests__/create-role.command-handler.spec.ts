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
  let policy: {
    assertGrantable: ReturnType<typeof vi.fn>;
    assertCanCreateGlobal: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    repo = {
      findOneByName: vi.fn().mockResolvedValue(None),
      insert: vi.fn().mockResolvedValue(undefined),
    };
    policy = {
      assertGrantable: vi.fn().mockResolvedValue(undefined),
      assertCanCreateGlobal: vi.fn().mockResolvedValue(undefined),
    };
    service = new CreateRoleCommandHandler(
      repo as RoleRepositoryPort,
      policy as unknown as RoleGrantPolicy,
    );
  });

  it('creates a non-system role with its permissions', async () => {
    await service.execute(
      new CreateRoleCommand({
        name: 'editor',
        description: 'Can edit articles',
        permissions: [{ action: 'update', subject: 'Article' }],
        organizationId: 'organization-1',
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
      service.execute(
        new CreateRoleCommand({
          name: 'editor',
          permissions: [],
          organizationId: 'organization-1',
        }),
      ),
    ).rejects.toMatchObject({ code: RoleErrors.NAME_TAKEN.code });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('creates and checks custom roles inside the active organization', async () => {
    await service.execute(
      new CreateRoleCommand({
        name: 'Content Lead',
        permissions: [],
        organizationId: 'organization-1',
      }),
    );

    expect(repo.findOneByName).toHaveBeenCalledWith('Content Lead', 'organization-1');
    const created = vi.mocked(repo.insert).mock.calls[0][0] as RoleEntity;
    expect(created.organizationId).toBe('organization-1');
  });

  describe('with no organization', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('refuses a %s tenant rather than creating a global role', async (_label, organizationId) => {
      await expect(
        service.execute(
          new CreateRoleCommand({
            name: 'editor',
            permissions: [],
            actorId: 'user-1',
            organizationId,
          }),
        ),
      ).rejects.toMatchObject({ code: RoleErrors.ORGANIZATION_REQUIRED.code });
      expect(policy.assertCanCreateGlobal).not.toHaveBeenCalled();
      expect(repo.insert).not.toHaveBeenCalled();
    });

    it('creates a global role only when asked explicitly, checking manage all', async () => {
      await service.execute(
        new CreateRoleCommand({
          name: 'auditor',
          permissions: [],
          actorId: 'user-1',
          actorRole: 'admin',
          organizationId: null,
          global: true,
        }),
      );

      expect(policy.assertCanCreateGlobal).toHaveBeenCalledWith({
        id: 'user-1',
        role: 'admin',
        organizationId: null,
      });
      expect(repo.findOneByName).toHaveBeenCalledWith('auditor', null);
      const created = vi.mocked(repo.insert).mock.calls[0][0] as RoleEntity;
      expect(created.organizationId).toBeNull();
    });

    it('does not create a global role when the actor lacks manage all', async () => {
      policy.assertCanCreateGlobal.mockRejectedValue(
        Object.assign(new Error('no'), { code: RoleErrors.PERMISSION_NOT_GRANTABLE.code }),
      );

      await expect(
        service.execute(
          new CreateRoleCommand({
            name: 'auditor',
            permissions: [],
            actorId: 'user-1',
            organizationId: null,
            global: true,
          }),
        ),
      ).rejects.toMatchObject({ code: RoleErrors.PERMISSION_NOT_GRANTABLE.code });
      expect(repo.insert).not.toHaveBeenCalled();
    });

    it('never creates a global role inside an organization, whatever `global` says', async () => {
      await service.execute(
        new CreateRoleCommand({
          name: 'editor',
          permissions: [],
          organizationId: 'organization-1',
          global: true,
        }),
      );

      expect(policy.assertCanCreateGlobal).not.toHaveBeenCalled();
      const created = vi.mocked(repo.insert).mock.calls[0][0] as RoleEntity;
      expect(created.organizationId).toBe('organization-1');
    });
  });
});
