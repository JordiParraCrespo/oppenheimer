import { AppError } from '@oppenheimer/backend-core';
import { defineAbilitiesFromPermissions, type PermissionDefinition } from '@oppenheimer/shared';
import { describe, expect, it, vi } from 'vitest';
import type { AbilityFactory } from '../ability.factory';
import { RoleGrantPolicy } from '../role-grant.policy';

function policyFor(actorPermissions: PermissionDefinition[]): RoleGrantPolicy {
  const abilityFactory = {
    createForUser: vi.fn().mockResolvedValue(defineAbilitiesFromPermissions(actorPermissions)),
  } as unknown as AbilityFactory;
  return new RoleGrantPolicy(abilityFactory);
}

const ACTOR = { id: 'admin-1', activeOrganizationId: 'org-1' };

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
});
