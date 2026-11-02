import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { defineAbilitiesFromPermissions, type PermissionDefinition } from '@oppenheimer/shared';
import { None } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { AbilityFactory } from '../../../application/ability.factory';
import { RoleGrantPolicy } from '../../../application/role-grant.policy';
import type { RoleRepositoryPort } from '../../../database/role.repository.port';
import type { RoleEntity } from '../../../domain/role.entity';
import { RoleErrors } from '../../../domain/role.errors';
import { RoleMapper } from '../../../roles.mapper';
import type { CreateRoleCommand } from '../create-role.command';
import { CreateRoleCommandHandler } from '../create-role.command-handler';
import { CreateRoleHttpController } from '../create-role.http.controller';

/**
 * `POST /v1/roles` with no active organization: the route asks for a global
 * role only for a platform admin, and the handler checks it again. Everyone
 * else gets ROLE_008 rather than a role every tenant reads.
 */
describe('CreateRoleHttpController with no active organization', () => {
  const ADMIN: PermissionDefinition[] = [{ action: 'manage', subject: 'all' }];
  const ROLE_EDITOR: PermissionDefinition[] = [{ action: 'create', subject: 'Role' }];

  function wiring(held: PermissionDefinition[]) {
    const ability = defineAbilitiesFromPermissions(held);
    const repo = {
      findOneByName: vi.fn().mockResolvedValue(None),
      insert: vi.fn().mockResolvedValue(undefined),
    };
    const handler = new CreateRoleCommandHandler(
      repo as unknown as RoleRepositoryPort,
      new RoleGrantPolicy({
        createForUser: vi.fn().mockResolvedValue(ability),
      } as unknown as AbilityFactory),
    );
    const commandBus = {
      execute: vi.fn((command: CreateRoleCommand) => handler.execute(command)),
    };
    const queryBus = {
      execute: vi.fn(async () => vi.mocked(repo.insert).mock.calls[0]?.[0] as RoleEntity),
    };
    const controller = new CreateRoleHttpController(
      commandBus as unknown as CommandBus,
      queryBus as unknown as QueryBus,
      new RoleMapper(),
    );
    // What the guards leave on the request: the caller's ability, and no tenant.
    const request = { ability, tenant: { organizationId: null } } as never;
    const create = () =>
      controller.create({ name: 'auditor', permissions: [] }, { id: 'user-1' }, request);
    return { repo, commandBus, create };
  }

  it('creates a global role for a platform admin (manage all)', async () => {
    const { repo, commandBus, create } = wiring(ADMIN);

    await create();

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: null, global: true }),
    );
    const created = vi.mocked(repo.insert).mock.calls[0][0] as RoleEntity;
    expect(created.organizationId).toBeNull();
  });

  it('answers ROLE_008 to anyone else', async () => {
    const { repo, commandBus, create } = wiring(ROLE_EDITOR);

    await expect(create()).rejects.toMatchObject({ code: RoleErrors.ORGANIZATION_REQUIRED.code });
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({ global: false }));
    expect(repo.insert).not.toHaveBeenCalled();
  });
});
