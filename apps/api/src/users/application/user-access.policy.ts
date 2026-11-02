import { AppError } from '@oppenheimer/backend-core';
import { canAccess } from '@oppenheimer/shared';
import { AuthErrors } from '../../auth/domain/auth.errors';
import type { AbilityRequest } from '../../roles/application/ability.factory';
import type { UserEntity } from '../domain/user.entity';

/**
 * Row-level authorization for a single user record. `PoliciesGuard` only answers "may
 * this caller read/update a User?" without the row, and a granted rule may be scoped to
 * `{ id: '${user.id}' }`, decidable only once the record is loaded. So every handler
 * that returns or writes one user asks again with the row in hand; skipping it reopens
 * the IDOR the conditions exist to close. Admins' `manage all` has no conditions.
 *
 * The failure is `AUTH_002`, the guard's code for a type-level denial: telling "no
 * permission" from "not your record" would confirm the id exists, the probing oracle
 * the auth catalog refuses to hand out.
 */
export function assertCanAccessUser(
  request: AbilityRequest,
  action: 'read' | 'update' | 'delete',
  user: UserEntity,
): void {
  const ability = request.ability;

  // The guard always builds and attaches the ability before a handler runs, so
  // an absent one means this route is not behind `PoliciesGuard` — fail closed
  // rather than silently skipping the check.
  if (!ability || !canAccess(ability, action, 'User', { id: user.id })) {
    throw new AppError(AuthErrors.FORBIDDEN);
  }
}
