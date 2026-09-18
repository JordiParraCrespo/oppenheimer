import { AppError } from '@oppenheimer/backend-core';
import { RoleErrors } from '../domain/role.errors';

/**
 * The one way to report a system role the database does not have.
 *
 * In `application/` rather than `domain/`, because it builds an `AppError` and
 * the domain layer may not reach for `@oppenheimer/backend-core`. The catalog
 * entry it raises is pure and stays in `domain/role.errors.ts`.
 *
 * Three paths need one: sign-up's default `user` grant, the org-scoped `owner`
 * grant the personal workspace writes, and the same grant on the hand-create
 * path in `OrganizationsService`. They used to answer three different things —
 * a silent `catch {}`, a problem document, and a bare `Error` with no code —
 * for one fault, which is the duplicated-rule problem in the failure path.
 *
 * The role name goes in `detail` and `extensions`, never in the title: the
 * catalog message is the stable part of the contract.
 */
export function missingSystemRole(roleName: string, userId?: string): AppError {
  return new AppError(RoleErrors.SYSTEM_ROLE_MISSING, {
    detail: `The system role "${roleName}" is missing. Run the migrations.`,
    extensions: userId ? { roleName, userId } : { roleName },
  });
}
