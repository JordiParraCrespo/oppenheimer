import type { AppAbility, PermissionDefinition } from '@oppenheimer/shared';

/**
 * Permissions in `requested` that `actorAbility` is not entitled to hand out.
 *
 * The invariant: **a role can never be given reach its author does not have.**
 * Without it, anyone who can edit roles can escalate to `manage all` and assign
 * it to themselves, which makes every other check decorative.
 *
 * This is the role-side twin of `grantableScopes` in `@oppenheimer/shared`, which
 * already enforces the same rule for credentials. Both exist because the two
 * escalation paths are separate: one mints a token, the other edits a role.
 *
 * A deny (`inverted`) is always grantable — narrowing reach cannot escalate.
 */
export function ungrantablePermissions(
  actorAbility: AppAbility,
  requested: readonly PermissionDefinition[],
): PermissionDefinition[] {
  return requested.filter((permission) => {
    if (permission.inverted) return false;

    // Field-level: the actor must hold the action on every field named, or they
    // would be granting access to a field they cannot read themselves.
    if (permission.fields && permission.fields.length > 0) {
      return !permission.fields.every((field) =>
        actorAbility.can(permission.action, permission.subject, field),
      );
    }

    return !actorAbility.can(permission.action, permission.subject);
  });
}

/** Whether every requested permission is within the actor's own reach. */
export function canGrant(
  actorAbility: AppAbility,
  requested: readonly PermissionDefinition[],
): boolean {
  return ungrantablePermissions(actorAbility, requested).length === 0;
}

/** Render a permission for an error message, e.g. `read Lead`. */
export function describePermission(permission: PermissionDefinition): string {
  const fields = permission.fields?.length ? ` (${permission.fields.join(', ')})` : '';
  return `${permission.action} ${permission.subject}${fields}`;
}
