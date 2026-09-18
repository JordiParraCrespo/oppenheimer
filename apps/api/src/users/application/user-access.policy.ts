import { AppError } from '@oppenheimer/backend-core';
import { canAccess } from '@oppenheimer/shared';
import { AuthErrors } from '../../auth/domain/auth.errors';
import type { AbilityRequest } from '../../roles/application/ability.factory';
import type { UserEntity } from '../domain/user.entity';

/**
 * Row-level authorization for a single user record.
 *
 * `PoliciesGuard` can only answer "may this caller read/update *a* User?" — it
 * never sees the row. An explicitly granted rule may be scoped to
 * `{ id: '${user.id}' }`, and a condition like that is only decidable once the
 * record is loaded, so every handler that returns or writes one user must ask
 * again with the row in hand. Skipping this call reopens the IDOR the
 * conditions exist to close.
 *
 * Admins hold `manage all`, which has no conditions, so they pass unchanged.
 *
 * The failure is `AUTH_002`, the same code the guard raises for a type-level
 * denial. Distinguishing "no permission at all" from "not your record" would
 * confirm that a given id exists, which is the probing oracle the auth catalog
 * deliberately refuses to hand out.
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
