import {
  type AbilityContext,
  type AppAbility,
  interpolatePermissionConditions,
  type PermissionDefinition,
} from '@oppenheimer/shared';

type ActorRule = ReturnType<AppAbility['rulesFor']>[number];

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
 * Containment respects conditions. A requested allow rule is grantable only
 * when, for each field it names (or once, when it names none), some allow rule
 * of the actor's for that action and subject **covers** it:
 *
 * - an unconditioned actor rule covers anything (this is how `manage all`
 *   grants everything);
 * - a conditioned actor rule covers a request whose own conditions are at least
 *   as narrow. Equality-only requests (plain scalar values, no operators, no
 *   nested paths) are covered when every top-level key of the actor's
 *   conditions is present in the request and the actor's conditions match the
 *   request's values; that key check is what stops `{ status: { $ne: 'x' } }`
 *   from matching a request that says nothing about `status`. Anything else is
 *   covered only by an actor rule with deep-equal conditions.
 *
 * An unconditioned request is therefore never covered by a conditioned rule: a
 * workspace owner holding `manage Session { organizationId: <org> }` cannot
 * write bare `manage Session`. Before the comparison the request's `${...}`
 * placeholders (`${user.*}`, `${activeOrganizationId}`, `${activeTeamId}`,
 * `${scope.*}`) are interpolated with `context`, which must be the context the
 * actor's ability was built with, so `{ organizationId: '${activeOrganizationId}' }`
 * and the literal id of the active organization both pass and another
 * organization's id does not. A placeholder the context cannot resolve is not
 * covered.
 *
 * Any actor deny that applies to the requested action, subject and field makes
 * the request ungrantable: whether the request avoids a conditioned deny cannot
 * be proven in general, so it is rejected rather than guessed at.
 *
 * A deny (`inverted`) is always grantable — narrowing reach cannot escalate.
 */
export function ungrantablePermissions(
  actorAbility: AppAbility,
  requested: readonly PermissionDefinition[],
  context: AbilityContext = {},
): PermissionDefinition[] {
  return requested.filter((permission) => {
    if (permission.inverted) return false;

    const conditions = permission.conditions
      ? interpolatePermissionConditions(permission.conditions, context)
      : undefined;

    // Field-level: the actor must hold the action on every field named, or they
    // would be granting access to a field they cannot read themselves.
    if (permission.fields && permission.fields.length > 0) {
      return !permission.fields.every((field) =>
        holds(actorAbility, permission, conditions, field),
      );
    }

    return !holds(actorAbility, permission, conditions);
  });
}

/** Whether every requested permission is within the actor's own reach. */
export function canGrant(
  actorAbility: AppAbility,
  requested: readonly PermissionDefinition[],
  context: AbilityContext = {},
): boolean {
  return ungrantablePermissions(actorAbility, requested, context).length === 0;
}

/**
 * Render a permission for an error message, e.g. `read Project` or
 * `read Session where {"organizationId":"org-1"}`.
 */
export function describePermission(permission: PermissionDefinition): string {
  const fields = permission.fields?.length ? ` (${permission.fields.join(', ')})` : '';
  const conditions = permission.conditions ? ` where ${JSON.stringify(permission.conditions)}` : '';
  return `${permission.action} ${permission.subject}${fields}${conditions}`;
}

/**
 * Whether the actor holds the requested reach for one field (or the whole
 * subject when `field` is undefined), given the request's interpolated
 * conditions.
 */
function holds(
  actorAbility: AppAbility,
  permission: PermissionDefinition,
  conditions: Record<string, unknown> | undefined,
  field?: string,
): boolean {
  // `rulesFor` already folds in the `manage` and `all` aliases. Without a
  // field it would also return field-limited allow rules, which do not cover a
  // request for the whole subject, so that case reads every rule and filters.
  const rules = field
    ? actorAbility.rulesFor(permission.action, permission.subject, field)
    : actorAbility.possibleRulesFor(permission.action, permission.subject);

  if (rules.some((rule) => rule.inverted)) return false;

  return rules.some((rule) => (field !== undefined || !rule.fields) && covers(rule, conditions));
}

/** Whether the actor's allow rule reaches every row the request would reach. */
function covers(rule: ActorRule, requested: Record<string, unknown> | undefined): boolean {
  const held = rule.conditions as Record<string, unknown> | undefined;
  if (held === undefined) return true;
  // Unconditioned (or collapsed to unrestricted) asks for more than any
  // conditioned rule holds; an unresolved placeholder asks for nothing we can
  // prove, even if the actor's rule carries the same unresolved one.
  if (requested === undefined || hasUndefined(requested)) return false;

  if (isEqualityOnly(requested)) {
    return (
      Object.keys(held).every((key) => Object.hasOwn(requested, key)) &&
      rule.matchesConditions(requested as never)
    );
  }

  return deepEqual(requested, held);
}

/**
 * Whether the conditions pin plain values only: no operators, no nested
 * objects or arrays, no dotted paths. Such conditions describe the row set
 * `{ key = value, ... }`, which can be tested against another rule directly.
 */
function isEqualityOnly(conditions: Record<string, unknown>): boolean {
  return Object.entries(conditions).every(
    ([key, value]) =>
      !key.startsWith('$') &&
      !key.includes('.') &&
      (value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'),
  );
}

function hasUndefined(value: unknown): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(hasUndefined);
  if (value && typeof value === 'object') return Object.values(value).some(hasUndefined);
  return false;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = Object.keys(left);
    if (keys.length !== Object.keys(right).length) return false;
    return keys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]));
  }
  return false;
}
