import { defineAbilitiesFromPermissions } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import type { AccessScope } from '../scope/access-scope';
import { canGrant, ungrantablePermissions } from './can-grant';
import { canGrantScope } from './can-grant-scope';

const abilityOf = (rules: Parameters<typeof defineAbilitiesFromPermissions>[0]) =>
  defineAbilitiesFromPermissions(rules);

describe('canGrant', () => {
  it('lets an actor grant what they already hold', () => {
    const actor = abilityOf([{ action: 'read', subject: 'Project' }]);
    expect(canGrant(actor, [{ action: 'read', subject: 'Project' }])).toBe(true);
  });

  it('blocks the escalation to `manage all`', () => {
    // The whole point: someone who can edit roles must not be able to write
    // themselves a role that outranks them.
    const actor = abilityOf([{ action: 'manage', subject: 'Role' }]);
    const requested = [{ action: 'manage', subject: 'all' }];

    expect(canGrant(actor, requested)).toBe(false);
    expect(ungrantablePermissions(actor, requested)).toEqual(requested);
  });

  it('lets a full-access actor grant anything', () => {
    const actor = abilityOf([{ action: 'manage', subject: 'all' }]);
    expect(canGrant(actor, [{ action: 'export', subject: 'Project' }])).toBe(true);
  });

  it('always allows a deny — narrowing reach cannot escalate', () => {
    const actor = abilityOf([{ action: 'read', subject: 'Project' }]);
    expect(canGrant(actor, [{ action: 'export', subject: 'Project', inverted: true }])).toBe(true);
  });

  it('requires the actor to hold every field they grant', () => {
    const actor = abilityOf([
      { action: 'read', subject: 'Project' },
      { action: 'read', subject: 'Project', fields: ['repoUrl'], inverted: true },
    ]);

    expect(canGrant(actor, [{ action: 'read', subject: 'Project', fields: ['name'] }])).toBe(true);
    expect(canGrant(actor, [{ action: 'read', subject: 'Project', fields: ['repoUrl'] }])).toBe(
      false,
    );
  });
});

function scope(overrides: Partial<AccessScope> = {}): AccessScope {
  return {
    userId: 'user-1',
    organizationId: 'org-1',
    teamIds: [],
    grants: new Map(),
    bypass: false,
    ...overrides,
  };
}

describe('canGrantScope', () => {
  it('allows granting a row the actor holds', () => {
    const actor = scope({ grants: new Map([['Project', new Set(['project-1'])]]) });
    expect(
      canGrantScope(actor, {
        organizationId: 'org-1',
        resourceType: 'Project',
        resourceId: 'project-1',
      }),
    ).toBe(true);
  });

  it('blocks granting a row the actor does not hold', () => {
    const actor = scope({ grants: new Map([['Project', new Set(['project-1'])]]) });
    expect(
      canGrantScope(actor, {
        organizationId: 'org-1',
        resourceType: 'Project',
        resourceId: 'project-2',
      }),
    ).toBe(false);
  });

  it('only lets an `all` holder mint an `all` grant', () => {
    const partial = scope({ grants: new Map([['Project', new Set(['project-1'])]]) });
    const full = scope({ grants: new Map([['Project', 'all']]) });
    const request = {
      organizationId: 'org-1',
      resourceType: 'Project',
      resourceId: null,
    };

    expect(canGrantScope(partial, request)).toBe(false);
    expect(canGrantScope(full, request)).toBe(true);
  });

  it('never crosses a tenant boundary', () => {
    const actor = scope({ grants: new Map([['Project', 'all']]) });
    expect(
      canGrantScope(actor, {
        organizationId: 'org-2',
        resourceType: 'Project',
        resourceId: null,
      }),
    ).toBe(false);
  });

  it('lets the platform tier through', () => {
    expect(
      canGrantScope(scope({ bypass: true }), {
        organizationId: 'org-2',
        resourceType: 'Project',
        resourceId: null,
      }),
    ).toBe(true);
  });
});
