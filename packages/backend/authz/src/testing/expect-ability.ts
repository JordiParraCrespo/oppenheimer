import {
  type AbilityContext,
  type AppAbility,
  defineAbilitiesFromPermissions,
  type PermissionDefinition,
} from '@oppenheimer/shared';
import { canAccessRow } from '../ability/can-access-row';
import { type AccessScope, toAbilityScopeContext } from '../scope/access-scope';

export interface ExpectAbilityContext {
  user?: Record<string, unknown> | null;
  scope?: AccessScope;
}

/**
 * Fluent assertions over a permission set.
 *
 * Policy tests are only written if they are cheap to write, and the raw
 * `defineAbilitiesFromPermissions(...)` + `subject(...)` dance is not cheap.
 * Every method throws on failure and returns `this`, so a policy reads as one
 * chain and any assertion library works.
 *
 * ```ts
 * expectAbility(role.permissions, { user, scope })
 *   .can('read', 'Lead')
 *   .cannot('export', 'Lead')
 *   .cannot('read', 'Lead', 'value')
 *   .canOn('update', 'Lead', { ownerId: user.id })
 *   .cannotOn('update', 'Lead', { ownerId: 'someone-else' });
 * ```
 */
export function expectAbility(
  permissions: readonly PermissionDefinition[],
  context: ExpectAbilityContext = {},
): AbilityAssertions {
  const abilityContext: AbilityContext = {
    user: context.user ?? null,
    organizationId: undefined,
    ...(context.scope ? { scope: toAbilityScopeContext(context.scope) } : {}),
  } as AbilityContext;

  return new AbilityAssertions(defineAbilitiesFromPermissions([...permissions], abilityContext));
}

export class AbilityAssertions {
  constructor(readonly ability: AppAbility) {}

  can(action: string, subject: string, field?: string): this {
    if (!this.ability.can(action, subject, field)) {
      throw new Error(`Expected ability to allow "${action} ${subject}${fieldSuffix(field)}"`);
    }
    return this;
  }

  cannot(action: string, subject: string, field?: string): this {
    if (this.ability.can(action, subject, field)) {
      throw new Error(`Expected ability to deny "${action} ${subject}${fieldSuffix(field)}"`);
    }
    return this;
  }

  /** Instance-level: check the action against a concrete row. */
  canOn(action: string, subject: string, row: Record<string, unknown>): this {
    if (!canAccessRow(this.ability, action, subject, row)) {
      throw new Error(`Expected ability to allow "${action} ${subject}" on ${JSON.stringify(row)}`);
    }
    return this;
  }

  cannotOn(action: string, subject: string, row: Record<string, unknown>): this {
    if (canAccessRow(this.ability, action, subject, row)) {
      throw new Error(`Expected ability to deny "${action} ${subject}" on ${JSON.stringify(row)}`);
    }
    return this;
  }
}

function fieldSuffix(field?: string): string {
  return field ? `.${field}` : '';
}
