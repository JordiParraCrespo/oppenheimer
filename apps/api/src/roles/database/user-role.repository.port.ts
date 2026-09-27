import { ROLES } from '@oppenheimer/shared';
import type { EntityManager } from 'typeorm';
import type { RoleEntity } from '../domain/role.entity';

/**
 * The system roles that stand for a membership: an organization's owners and
 * admins hold `owner` scoped to it, every other member holds `user` there. A
 * member holds exactly one of them in each organization they belong to.
 */
export const MEMBERSHIP_ROLES = [ROLES.OWNER, ROLES.USER] as const;

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
  /** Replace the user's role assignments **within one scope**. */
  setRolesForUser(userId: string, roleIds: string[], organizationId?: string | null): Promise<void>;

  /**
   * Make `roleId` the membership role (see {@link MEMBERSHIP_ROLES}) the user
   * holds in exactly `organizationId` — what a roster change calls when a
   * member's organization role moves.
   *
   * In one transaction: the user's assignments of the *other* membership roles
   * scoped to that organization are removed, `roleId` is granted there, and the
   * organization's role version is bumped. Nothing else is touched — not a
   * custom role an admin assigned in that organization (even one the user also
   * holds globally: the scoped row is its own grant), not a global assignment,
   * not another organization's.
   */
  replaceMembershipRole(userId: string, organizationId: string, roleId: string): Promise<void>;

  /**
   * Grant one role, leaving every other assignment the user holds alone.
   *
   * Additive on purpose, and distinct from `setRolesForUser`: the caller is
   * sign-up handing a new account its default role, which must not be able to
   * revoke anything. Granting a role the user already holds in that scope is a
   * no-op, so the operation is safe to repeat.
   *
   * `manager` enlists the grant in a transaction the caller already owns, which
   * is what lets the personal workspace write its organization, its membership
   * and this grant as one unit without a second writer against `user_role`.
   * Omitted, the grant runs in its own transaction as any other write does.
   */
  assignRoleToUser(
    userId: string,
    roleId: string,
    organizationId?: string | null,
    manager?: EntityManager,
  ): Promise<void>;
}
