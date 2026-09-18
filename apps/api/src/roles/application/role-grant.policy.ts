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

/** Who is performing a role write, and in which organization. */
export interface RoleActor {
  id: string;
  role?: string;
  activeOrganizationId?: string | null;
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

    const ability = await this.abilityFactory.createForUser(
      { id: actor.id, role: actor.role },
      { activeOrganizationId: actor.activeOrganizationId ?? null },
    );

    const ungrantable = ungrantablePermissions(ability, permissions);
    if (ungrantable.length === 0) return;

    throw new AppError(RoleErrors.PERMISSION_NOT_GRANTABLE, {
      detail: `You do not hold: ${ungrantable.map(describePermission).join(', ')}`,
      extensions: { ungrantable },
    });
  }

  /**
   * Whether the actor may write *this* role row, not just "a Role".
   *
   * `@CheckPolicies` is a type-level check, and a role lookup scoped to the
   * active organization returns the platform's global roles alongside the
   * tenant's own. The tenant `owner` role's `manage Role` is conditioned on
   * `organizationId = ${activeOrganizationId}`, so a global role (`null`) does
   * not match it — without this check an organization owner could rewrite the
   * default `user` role for every tenant. A platform admin's `manage all`
   * matches any row.
   */
  async assertCanModify(actor: RoleActor | undefined, role: RoleEntity): Promise<void> {
    if (!actor) return;

    const ability = await this.abilityFactory.createForUser(
      { id: actor.id, role: actor.role },
      { activeOrganizationId: actor.activeOrganizationId ?? null },
    );

    const row = { id: role.id, organizationId: role.organizationId };
    if (canAccessRow(ability, 'update', 'Role', row)) return;

    throw new AppError(RoleErrors.CROSS_ORGANIZATION_ROLE, {
      detail: role.isGlobal()
        ? 'Global roles are managed by the platform, not from within an organization.'
        : 'That role belongs to another organization.',
    });
  }
}
