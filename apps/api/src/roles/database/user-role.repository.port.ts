import type { EntityManager } from 'typeorm';
import type { RoleEntity } from '../domain/role.entity';

/**
 * Port for the user ↔ role assignment join. Kept separate from the role
 * aggregate repository because it manages a link table rather than an
 * aggregate of its own.
 *
 * The optional `organizationId` selects the scope of an operation. Reads that
 * pass one get the caller's global assignments **plus** the ones scoped to that
 * organization; reads that omit it get every assignment, which is what
 * management screens need. Writes default to the global scope.
 */
export interface UserRoleRepositoryPort {
  findRoleIdsForUser(userId: string, organizationId?: string | null): Promise<string[]>;
  findRolesForUser(userId: string, organizationId?: string | null): Promise<RoleEntity[]>;
  /**
   * Replace the user's role assignments **within one scope**. With `manager`
   * the write joins that transaction, for a caller whose unit of work spans
   * more than this table; without it the replacement is its own transaction.
   */
  setRolesForUser(
    userId: string,
    roleIds: string[],
    organizationId?: string | null,
    manager?: EntityManager,
  ): Promise<void>;

  /**
   * Make `roleId` the membership role (`MEMBERSHIP_ROLES` in `@oppenheimer/shared`) the
   * user holds in exactly `organizationId`. In one transaction: the user's other
   * membership roles scoped there are removed, `roleId` is granted there and the
   * organization's role version is bumped. Nothing else is touched: not a custom role
   * assigned there (even one also held globally: the scoped row is its own grant), not a
   * global assignment, not another organization's.
   */
  replaceMembershipRole(userId: string, organizationId: string, roleId: string): Promise<void>;

  /**
   * Grant one role, leaving every other assignment alone. Additive on purpose, unlike
   * `setRolesForUser`: sign-up hands a new account its default role through it, which
   * must not be able to revoke anything. Granting a role already held in that scope is a
   * no-op, so it is safe to repeat.
   *
   * `manager` enlists the grant in the caller's transaction, so the personal workspace
   * writes its organization, membership and this grant as one unit; omitted, the grant
   * runs in its own.
   */
  assignRoleToUser(
    userId: string,
    roleId: string,
    organizationId?: string | null,
    manager?: EntityManager,
  ): Promise<void>;
}
