import { Injectable } from '@nestjs/common';
import {
  canAccessRow,
  describePermission,
  ungrantablePermissions,
} from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { PermissionDefinition } from '@oppenheimer/shared';
import type { RoleEntity } from '../domain/role.entity';
import { RoleErrors } from '../domain/role.errors';
import { AbilityFactory } from './ability.factory';

export interface RoleActor {
  id: string;
  role?: string;
  organizationId?: string | null;
}

/**
 * Enforces that a role write never grants more than its author holds.
 *
 * `grantableScopes` already stops a credential exceeding its creator; this is
 * the same invariant on the other escalation path. Without it, `update Role`
 * is effectively `manage all`: an org admin could write themselves a role that
 * outranks them and assign it in the same session.
 */
@Injectable()
export class RoleGrantPolicy {
  constructor(private readonly abilityFactory: AbilityFactory) {}

  async assertGrantable(
    actor: RoleActor | undefined,
    permissions: readonly PermissionDefinition[],
  ): Promise<void> {
    if (permissions.length === 0) return;

    // No actor means an internal caller (a seed, a migration backfill) rather
    // than a request. Those are trusted by construction — they are the code
    // that defines the system roles in the first place.
    if (!actor) return;

    const user = { id: actor.id, role: actor.role };
    const organizationId = actor.organizationId ?? null;
    const ability = await this.abilityFactory.createForUser(user, { organizationId });

    // Containment compares the request's conditions with the actor's rules, so
    // its `${...}` placeholders must resolve exactly as they did when
    // `createForUser` built the ability: same principal, same organization, no
    // active team.
    const ungrantable = ungrantablePermissions(ability, permissions, {
      user,
      activeOrganizationId: organizationId,
      activeTeamId: null,
    });
    if (ungrantable.length === 0) return;

    // A type-level `can` is true when the actor holds the action on the
    // subject anywhere, which is the case of holding it only under narrower
    // conditions than the request asks for.
    const lacking = ungrantable.filter((rule) => !ability.can(rule.action, rule.subject));
    const narrower = ungrantable.filter((rule) => ability.can(rule.action, rule.subject));
    const detail = [
      lacking.length > 0 ? `You do not hold: ${lacking.map(describePermission).join(', ')}` : '',
      narrower.length > 0
        ? `You hold only narrower conditions than: ${narrower.map(describePermission).join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('. ');

    throw new AppError(RoleErrors.PERMISSION_NOT_GRANTABLE, {
      detail,
      extensions: { ungrantable },
    });
  }

  /**
   * Whether the actor may write this role row, not just "a Role". `@CheckPolicies` is
   * type-level, and a role lookup scoped to the active organization returns the global
   * roles alongside the tenant's. The tenant `owner`'s `manage Role` is conditioned on
   * `organizationId = ${activeOrganizationId}`, which a global role (`null`) does not
   * match; without this check an organization owner could rewrite the default `user`
   * role for every tenant. A platform admin's `manage all` matches any row.
   */
  async assertCanModify(actor: RoleActor | undefined, role: RoleEntity): Promise<void> {
    if (!actor) return;

    const ability = await this.abilityFactory.createForUser(
      { id: actor.id, role: actor.role },
      { organizationId: actor.organizationId ?? null },
    );

    const row = { id: role.id, organizationId: role.organizationId };
    if (canAccessRow(ability, 'update', 'Role', row)) return;

    throw new AppError(RoleErrors.CROSS_ORGANIZATION_ROLE, {
      detail: role.isGlobal()
        ? 'Global roles are managed by the platform, not from within an organization.'
        : 'That role belongs to another organization.',
    });
  }

  /**
   * Whether the actor may create a **global** role: one with no organization,
   * which every tenant's ability reads. That is platform-wide reach, so it
   * takes `manage all` in the platform scope (no active organization), not the
   * tenant `owner`'s conditioned `manage Role`. No actor is an internal caller
   * (a seed, a test fixture), trusted as `assertGrantable` trusts it.
   */
  async assertCanCreateGlobal(actor: RoleActor | undefined): Promise<void> {
    if (!actor) return;

    const ability = await this.abilityFactory.createForUser(
      { id: actor.id, role: actor.role },
      { organizationId: null },
    );
    if (ability.can('manage', 'all')) return;

    throw new AppError(RoleErrors.PERMISSION_NOT_GRANTABLE, {
      detail: 'Creating a global role takes "manage all" on the platform.',
    });
  }
}
