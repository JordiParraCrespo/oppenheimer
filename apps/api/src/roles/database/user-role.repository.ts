import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MEMBERSHIP_ROLES } from '@oppenheimer/shared';
import { type EntityManager, In, IsNull, type Repository } from 'typeorm';
import type { RoleEntity } from '../domain/role.entity';
import { RoleMapper } from '../roles.mapper';
import { bumpForAssignment, bumpRoleVersion } from './authz-version.repository';
import { RoleOrmEntity } from './role.orm-entity';
import { UserRoleOrmEntity } from './user-role.orm-entity';
import type { UserRoleRepositoryPort } from './user-role.repository.port';

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

  async findRolesForUser(userId: string, organizationId?: string | null): Promise<RoleEntity[]> {
    const roleIds = await this.findRoleIdsForUser(userId, organizationId);
    if (roleIds.length === 0) return [];
    // Ordered, so two users holding the same roles get them (and the permission
    // union built from them) in the same order, not Postgres's physical row order.
    const records = await this.roleRepository.find({
      where: { id: In(roleIds) },
      order: { name: 'ASC' },
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async assignRoleToUser(
    userId: string,
    roleId: string,
    organizationId: string | null = null,
    manager?: EntityManager,
  ): Promise<void> {
    // The grant and its version bump commit together, in the caller's
    // transaction or in one of our own: a grant whose bump was lost would stay
    // invisible to a cached reader until the entry expired.
    if (!manager) {
      await this.userRoleRepository.manager.transaction((own) =>
        this.assignRoleToUser(userId, roleId, organizationId, own),
      );
      return;
    }
    // `ON CONFLICT DO NOTHING` against the migration's two partial unique
    // indexes (one per scope), so a repeat grant is silent rather than a
    // constraint violation the caller has to tell apart from a real failure.
    await manager
      .createQueryBuilder()
      .insert()
      .into(UserRoleOrmEntity)
      .values({ userId, roleId, organizationId })
      .orIgnore()
      .execute();
    await bumpForAssignment(manager, userId, organizationId);
  }

  async replaceMembershipRole(
    userId: string,
    organizationId: string,
    roleId: string,
  ): Promise<void> {
    await this.userRoleRepository.manager.transaction(async (manager) => {
      // The global system roles a membership maps onto, read in the same
      // transaction as the swap: the rows it may remove. Anything else scoped
      // to the organization is left alone.
      const membershipRoles = await manager.find(RoleOrmEntity, {
        where: { name: In([...MEMBERSHIP_ROLES]), organizationId: IsNull() },
        select: { id: true },
      });
      const replaced = membershipRoles.map((role) => role.id).filter((id) => id !== roleId);
      if (replaced.length > 0) {
        await manager.delete(UserRoleOrmEntity, {
          userId,
          organizationId,
          roleId: In(replaced),
        });
      }
      await manager
        .createQueryBuilder()
        .insert()
        .into(UserRoleOrmEntity)
        .values({ userId, roleId, organizationId })
        .orIgnore()
        .execute();
      await bumpRoleVersion(manager, organizationId);
    });
  }

  async setRolesForUser(
    userId: string,
    roleIds: string[],
    organizationId: string | null = null,
    manager?: EntityManager,
  ): Promise<void> {
    // Assignments in other organizations are left alone: replacing a user's
    // roles in one tenant must not silently revoke them in another.
    const uniqueRoleIds = [...new Set(roleIds)];
    const replace = async (tx: EntityManager) => {
      await tx.delete(UserRoleOrmEntity, {
        userId,
        organizationId: organizationId ?? IsNull(),
      });
      if (uniqueRoleIds.length > 0) {
        await tx.insert(
          UserRoleOrmEntity,
          uniqueRoleIds.map((roleId) => ({ userId, roleId, organizationId })),
        );
      }
      await bumpForAssignment(tx, userId, organizationId);
    };
    if (manager) await replace(manager);
    else await this.userRoleRepository.manager.transaction(replace);
  }
}
