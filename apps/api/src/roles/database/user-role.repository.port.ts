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
  /** Replace the user's role assignments **within one scope**. */
  setRolesForUser(userId: string, roleIds: string[], organizationId?: string | null): Promise<void>;

  /**
   * Grant one role, leaving every other assignment the user holds alone.
   *
   * Additive on purpose, and distinct from `setRolesForUser`: the caller is
   * sign-up handing a new account its default role, which must not be able to
   * revoke anything. Granting a role the user already holds in that scope is a
   * no-op, so the operation is safe to repeat.
   */
  assignRoleToUser(userId: string, roleId: string, organizationId?: string | null): Promise<void>;
}
