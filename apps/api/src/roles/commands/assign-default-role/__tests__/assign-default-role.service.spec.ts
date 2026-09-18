import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleRepositoryPort } from '../../../database/role.repository.port';
import type { UserRoleRepositoryPort } from '../../../database/user-role.repository.port';
import { RoleErrors } from '../../../domain/role.errors';
import { AssignDefaultRoleCommand } from '../assign-default-role.command';
import { AssignDefaultRoleService } from '../assign-default-role.service';

const command = new AssignDefaultRoleCommand({ userId: 'user-uuid' });

describe('AssignDefaultRoleService', () => {
  let service: AssignDefaultRoleService;
  let roles: Pick<RoleRepositoryPort, 'findOneByName'>;
  let userRoles: Pick<UserRoleRepositoryPort, 'assignRoleToUser' | 'setRolesForUser'>;

  beforeEach(() => {
    roles = { findOneByName: vi.fn().mockResolvedValue(Some({ id: 'user-role-uuid' })) };
    userRoles = {
      assignRoleToUser: vi.fn().mockResolvedValue(undefined),
      setRolesForUser: vi.fn().mockResolvedValue(undefined),
    };
    service = new AssignDefaultRoleService(
      roles as RoleRepositoryPort,
      userRoles as UserRoleRepositoryPort,
    );
  });

  it('grants the default `user` role globally', async () => {
    await service.execute(command);

    expect(roles.findOneByName).toHaveBeenCalledWith('user', null);
    expect(userRoles.assignRoleToUser).toHaveBeenCalledWith('user-uuid', 'user-role-uuid', null);
  });

  it('never replaces the roles the account already holds', async () => {
    await service.execute(command);

    // `setRolesForUser` replaces a scope wholesale, which for a seeded admin
    // signing up would drop the elevation it was just given. The grant has to
    // be additive.
    expect(userRoles.setRolesForUser).not.toHaveBeenCalled();
  });

  it('is a no-op the second time, because the grant is', async () => {
    await service.execute(command);
    await service.execute(command);

    // The adapter inserts with `ON CONFLICT DO NOTHING`, so repeating the
    // command cannot fail — sign-up and the seed both run it for one account.
    expect(userRoles.assignRoleToUser).toHaveBeenCalledTimes(2);
  });

  it('reports a missing system role as a deployment fault, not a 404', async () => {
    vi.mocked(roles.findOneByName).mockResolvedValue(None);

    // Nobody named this role in a request, so `ROLE_001 Role not found` would
    // describe a caller mistake that did not happen. The migrations install it.
    const error = await service.execute(command).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(RoleErrors.SYSTEM_ROLE_MISSING.code);
    expect((error as AppError).getStatus()).toBe(500);
    expect(userRoles.assignRoleToUser).not.toHaveBeenCalled();
  });
});
