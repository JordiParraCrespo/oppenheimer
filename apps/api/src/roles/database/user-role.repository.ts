import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, type Repository } from 'typeorm';
import type { RoleEntity } from '../domain/role.entity';
import { RoleMapper } from '../roles.mapper';
import { RoleOrmEntity } from './role.orm-entity';
import { UserRoleOrmEntity } from './user-role.orm-entity';
import type { UserRoleRepositoryPort } from './user-role.repository.port';

/**
 * TypeORM-backed adapter for the user ↔ role join. Reads resolve to domain
 * `RoleEntity` instances (via `RoleMapper`) so callers — notably the
 * `AbilityFactory` — work in domain terms.
 */
@Injectable()
export class UserRoleRepository implements UserRoleRepositoryPort {
  constructor(
    @InjectRepository(UserRoleOrmEntity)
    private readonly userRoleRepository: Repository<UserRoleOrmEntity>,
    @InjectRepository(RoleOrmEntity)
    private readonly roleRepository: Repository<RoleOrmEntity>,
    private readonly mapper: RoleMapper,
  ) {}

  async findRoleIdsForUser(userId: string, organizationId?: string | null): Promise<string[]> {
    const links = await this.userRoleRepository.find({
      where:
        organizationId === undefined
          ? { userId }
          : // Global assignments apply everywhere, so they are always part of
            // the answer alongside the ones scoped to the active organization.
            [
              { userId, organizationId: IsNull() },
              ...(organizationId ? [{ userId, organizationId }] : []),
            ],
    });
    return [...new Set(links.map((link) => link.roleId))];
  }

  /**
   * The roles in effect for a user.
   *
   * Passing an organization returns their global assignments plus the ones
   * scoped to that organization — the union that makes a role granted in one
   * tenant inert in another. Omitting it returns every assignment regardless of
   * scope, which is what role-management screens need.
   */
  async findRolesForUser(userId: string, organizationId?: string | null): Promise<RoleEntity[]> {
    const roleIds = await this.findRoleIdsForUser(userId, organizationId);
    if (roleIds.length === 0) return [];
    // Ordered, because callers index into this. Without it Postgres answers in
    // whatever physical order the rows happen to sit in, so two users holding
    // the *same* roles came back in different orders — and the team table,
    // which labelled a row with the first one, showed them different roles.
    const records = await this.roleRepository.find({
      where: { id: In(roleIds) },
      order: { name: 'ASC' },
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async setRolesForUser(
    userId: string,
    roleIds: string[],
    organizationId: string | null = null,
  ): Promise<void> {
    // Replace the full set for this scope atomically. Assignments in other
    // organizations are left alone: replacing a user's roles in one tenant must
    // not silently revoke them in another.
    const uniqueRoleIds = [...new Set(roleIds)];
    await this.userRoleRepository.manager.transaction(async (manager) => {
      await manager.delete(UserRoleOrmEntity, {
        userId,
        organizationId: organizationId ?? IsNull(),
      });
      if (uniqueRoleIds.length > 0) {
        await manager.insert(
          UserRoleOrmEntity,
          uniqueRoleIds.map((roleId) => ({ userId, roleId, organizationId })),
        );
      }
      if (organizationId) await bumpRoleVersion(manager, organizationId);
    });
  }
}

/**
 * Invalidate every cached ability in an organization by bumping its version.
 *
 * Written inside the caller's transaction on purpose. Routing this through the
 * outbox would be eventually consistent — `OutboxService.wake()` swallows
 * delivery failures and leaves rows for the next poll — and permission
 * revocation is exactly the case that cannot tolerate that.
 */
export async function bumpRoleVersion(
  manager: { query: (sql: string, parameters?: unknown[]) => Promise<unknown> },
  organizationId: string,
): Promise<void> {
  await manager.query(
    'UPDATE "organization" SET "roleVersion" = "roleVersion" + 1 WHERE "id" = $1',
    [organizationId],
  );
}
