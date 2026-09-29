import { AppError } from '@oppenheimer/backend-core';
import {
  defineAbilitiesFromPermissions,
  type PermissionDefinition,
  SYSTEM_ROLE_PERMISSIONS,
} from '@oppenheimer/shared';
import { describe, expect, it, vi } from 'vitest';
import { RoleEntity } from '../../domain/role.entity';
import type { AbilityFactory } from '../ability.factory';
import { RoleGrantPolicy } from '../role-grant.policy';

function policyFor(actorPermissions: PermissionDefinition[]): RoleGrantPolicy {
  const abilityFactory = {
    createForUser: vi.fn().mockResolvedValue(defineAbilitiesFromPermissions(actorPermissions)),
  } as unknown as AbilityFactory;
  return new RoleGrantPolicy(abilityFactory);
}

const ACTOR = { id: 'admin-1', organizationId: 'org-1' };

/**
 * A policy whose actor ability is built the way `AbilityFactory.createForUser`
 * builds it for `ACTOR`: the given rules interpolated in `ACTOR`'s context.
 */
function policyInContext(actorPermissions: PermissionDefinition[]): {
  policy: RoleGrantPolicy;
  abilityFactory: AbilityFactory;
} {
  const ability = defineAbilitiesFromPermissions(actorPermissions, {
    user: { id: ACTOR.id },
    activeOrganizationId: ACTOR.organizationId,
    activeTeamId: null,
  });
  const abilityFactory = {
    createForUser: vi.fn().mockResolvedValue(ability),
  } as unknown as AbilityFactory;
  return { policy: new RoleGrantPolicy(abilityFactory), abilityFactory };
}

// biome-ignore lint/suspicious/noTemplateCurlyInString: a condition placeholder, not a template literal
const ORG = '${activeOrganizationId}';

describe('RoleGrantPolicy', () => {
  it('allows granting what the actor already holds', async () => {
    const policy = policyFor([{ action: 'read', subject: 'Project' }]);

    await expect(
      policy.assertGrantable(ACTOR, [{ action: 'read', subject: 'Project' }]),
    ).resolves.toBeUndefined();
  });

  it('blocks a role editor from writing themselves `manage all`', async () => {
    // Without this, `update Role` is effectively `manage all`: compose the
    // role, assign it to yourself, done.
    const policy = policyFor([{ action: 'manage', subject: 'Role' }]);

    await expect(
      policy.assertGrantable(ACTOR, [{ action: 'manage', subject: 'all' }]),
    ).rejects.toThrow(AppError);
  });

  it('names what the actor is short of', async () => {
    const policy = policyFor([{ action: 'read', subject: 'Project' }]);

    // The catalog message titles the problem and stays stable; what this
    // caller is short of belongs in `detail`.
    const error = await policy
      .assertGrantable(ACTOR, [{ action: 'export', subject: 'Project' }])
      .catch((thrown: AppError) => thrown);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).detail).toContain('export Project');
  });

  it('lets a full-access actor grant anything', async () => {
    const policy = policyFor([{ action: 'manage', subject: 'all' }]);

    await expect(
      policy.assertGrantable(ACTOR, [
        { action: 'export', subject: 'Project' },
        { action: 'manage', subject: 'all' },
      ]),
    ).resolves.toBeUndefined();
  });

  describe('with conditioned actor rules (the tenant owner)', () => {
    it('rejects an unconditioned rule the owner holds only for its organization', async () => {
      const { policy } = policyInContext(SYSTEM_ROLE_PERMISSIONS.owner);

      const error = await policy
        .assertGrantable(ACTOR, [{ action: 'manage', subject: 'Session' }])
        .catch((thrown: AppError) => thrown);

      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('ROLE_005');
      expect((error as AppError).detail).toContain('narrower conditions');
      expect((error as AppError).detail).toContain('manage Session');
    });

    it('accepts the rule scoped to the active organization, as placeholder or literal', async () => {
      const { policy } = policyInContext(SYSTEM_ROLE_PERMISSIONS.owner);

      await expect(
        policy.assertGrantable(ACTOR, [
          { action: 'read', subject: 'Session', conditions: { organizationId: ORG } },
          { action: 'read', subject: 'Session', conditions: { organizationId: 'org-1' } },
        ]),
      ).resolves.toBeUndefined();
    });

    it('rejects a rule pointed at another organization', async () => {
      const { policy } = policyInContext(SYSTEM_ROLE_PERMISSIONS.owner);

      await expect(
        policy.assertGrantable(ACTOR, [
          { action: 'manage', subject: 'Project', conditions: { organizationId: 'org-2' } },
        ]),
      ).rejects.toMatchObject({ code: 'ROLE_005' });
    });

    it('lists exactly the offending rules', async () => {
      const { policy } = policyInContext(SYSTEM_ROLE_PERMISSIONS.owner);
      const offending: PermissionDefinition[] = [
        { action: 'manage', subject: 'Session' },
        { action: 'manage', subject: 'Project', conditions: { organizationId: 'org-2' } },
        { action: 'manage', subject: 'User' },
      ];

      const error = await policy
        .assertGrantable(ACTOR, [
          { action: 'read', subject: 'Session', conditions: { organizationId: ORG } },
          ...offending,
        ])
        .catch((thrown: AppError) => thrown);

      expect((error as AppError).extensions).toEqual({ ungrantable: offending });
      // `User` is not held at all; the other two are held more narrowly.
      expect((error as AppError).detail).toContain('You do not hold: manage User');
    });

    it('builds the ability in the actor organization', async () => {
      const { policy, abilityFactory } = policyInContext(SYSTEM_ROLE_PERMISSIONS.owner);

      await policy.assertGrantable(ACTOR, [
        { action: 'read', subject: 'Session', conditions: { organizationId: ORG } },
      ]);

      expect(abilityFactory.createForUser).toHaveBeenCalledWith(
        { id: ACTOR.id, role: undefined },
        { organizationId: 'org-1' },
      );
    });
  });

  it('lets `manage all` grant the conditioned owner role', async () => {
    const { policy } = policyInContext([{ action: 'manage', subject: 'all' }]);

    await expect(
      policy.assertGrantable(ACTOR, SYSTEM_ROLE_PERMISSIONS.owner),
    ).resolves.toBeUndefined();
  });

  it('trusts an internal caller with no actor', async () => {
    // Seeds and migration backfills are the code that defines the system roles;
    // there is no ability to check them against.
    const policy = policyFor([]);

    await expect(
      policy.assertGrantable(undefined, [{ action: 'manage', subject: 'all' }]),
    ).resolves.toBeUndefined();
  });

  it('skips the lookup entirely for an empty permission set', async () => {
    const abilityFactory = {
      createForUser: vi.fn(),
    } as unknown as AbilityFactory;
    const policy = new RoleGrantPolicy(abilityFactory);

    await policy.assertGrantable(ACTOR, []);

    expect(abilityFactory.createForUser).not.toHaveBeenCalled();
  });

  describe('assertCanCreateGlobal', () => {
    it('allows an actor holding manage all, asked in the platform scope', async () => {
      const { policy, abilityFactory } = policyInContext([{ action: 'manage', subject: 'all' }]);

      await expect(policy.assertCanCreateGlobal(ACTOR)).resolves.toBeUndefined();
      expect(abilityFactory.createForUser).toHaveBeenCalledWith(
        { id: ACTOR.id, role: undefined },
        { organizationId: null },
      );
    });

    it("refuses a tenant owner's conditioned manage Role", async () => {
      const policy = policyFor([
        { action: 'manage', subject: 'Role', conditions: { organizationId: ORG } },
      ]);

      await expect(policy.assertCanCreateGlobal(ACTOR)).rejects.toMatchObject({
        code: 'ROLE_005',
      });
    });

    it('trusts an internal caller with no actor', async () => {
      await expect(policyFor([]).assertCanCreateGlobal(undefined)).resolves.toBeUndefined();
    });
  });

  describe('assertCanModify', () => {
    const roleIn = (organizationId: string | null) =>
      RoleEntity.create({
        id: 'role-1',
        props: {
          name: 'user',
          description: null,
          isSystem: false,
          organizationId,
          permissions: [],
        },
      });

    it("lets the tenant owner modify their own organization's role", async () => {
      const { policy } = policyInContext(SYSTEM_ROLE_PERMISSIONS.owner);

      await expect(policy.assertCanModify(ACTOR, roleIn('org-1'))).resolves.toBeUndefined();
    });

    // A role lookup in an organization also returns the platform's global
    // roles: without this, an owner could rewrite `user` for every tenant.
    it.each([
      ['a global role', null, 'Global roles are managed by the platform'],
      ["another organization's role", 'org-2', 'belongs to another organization'],
    ])('refuses the tenant owner %s (ROLE_006)', async (_label, organizationId, detail) => {
      const { policy } = policyInContext(SYSTEM_ROLE_PERMISSIONS.owner);

      const error = await policy
        .assertCanModify(ACTOR, roleIn(organizationId))
        .catch((thrown: AppError) => thrown);

      expect(error).toMatchObject({ code: 'ROLE_006' });
      expect((error as AppError).detail).toContain(detail);
    });

    it('lets `manage all` modify a global role', async () => {
      const { policy } = policyInContext([{ action: 'manage', subject: 'all' }]);

      await expect(policy.assertCanModify(ACTOR, roleIn(null))).resolves.toBeUndefined();
    });

    it('trusts an internal caller with no actor', async () => {
      await expect(policyFor([]).assertCanModify(undefined, roleIn(null))).resolves.toBeUndefined();
    });
  });
});
