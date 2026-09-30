import { AppError } from '@oppenheimer/backend-core';
import { RoleErrors } from '../domain/role.errors';

/**
 * The one way to report a system role the database does not have, for sign-up's
 * default `user` grant, the personal workspace's `owner` grant and the `owner` or `user`
 * grant every roster change makes (`organizations/application/membership-access.policy.ts`).
 *
 * In `application/` because it builds an `AppError`, which the domain may not reach
 * for; the catalog entry stays in `domain/role.errors.ts`. The role name goes in
 * `detail` and `extensions`, never the title: the catalog message is the stable part.
 */
export function missingSystemRole(roleName: string, userId?: string): AppError {
  return new AppError(RoleErrors.SYSTEM_ROLE_MISSING, {
    detail: `The system role "${roleName}" is missing. Run the migrations.`,
    extensions: userId ? { roleName, userId } : { roleName },
  });
}
