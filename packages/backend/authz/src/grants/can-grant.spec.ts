import { defineAbilitiesFromPermissions } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import type { AccessScope } from '../scope/access-scope';
import { canGrant, ungrantablePermissions } from './can-grant';
import { canGrantScope } from './can-grant-scope';

const abilityOf = (rules: Parameters<typeof defineAbilitiesFromPermissions>[0]) =>
  defineAbilitiesFromPermissions(rules);

describe('canGrant', () => {
  it('lets an actor grant what they already hold', () => {
    const actor = abilityOf([{ action: 'read', subject: 'Lead' }]);
    expect(canGrant(actor, [{ action: 'read', subject: 'Lead' }])).toBe(true);
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
    expect(canGrant(actor, [{ action: 'export', subject: 'Lead' }])).toBe(true);
  });

  it('always allows a deny — narrowing reach cannot escalate', () => {
    const actor = abilityOf([{ action: 'read', subject: 'Lead' }]);
    expect(canGrant(actor, [{ action: 'export', subject: 'Lead', inverted: true }])).toBe(true);
  });

  it('requires the actor to hold every field they grant', () => {
    const actor = abilityOf([
      { action: 'read', subject: 'Lead' },
      { action: 'read', subject: 'Lead', fields: ['value'], inverted: true },
    ]);

    expect(canGrant(actor, [{ action: 'read', subject: 'Lead', fields: ['notes'] }])).toBe(true);
    expect(canGrant(actor, [{ action: 'read', subject: 'Lead', fields: ['value'] }])).toBe(false);
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
    const actor = scope({ grants: new Map([['Lead', new Set(['lead-1'])]]) });
    expect(
      canGrantScope(actor, {
        organizationId: 'org-1',
        resourceType: 'Lead',
        resourceId: 'lead-1',
      }),
    ).toBe(true);
  });

  it('blocks granting a row the actor does not hold', () => {
    const actor = scope({ grants: new Map([['Lead', new Set(['lead-1'])]]) });
    expect(
      canGrantScope(actor, {
        organizationId: 'org-1',
        resourceType: 'Lead',
        resourceId: 'lead-2',
      }),
    ).toBe(false);
  });

  it('only lets an `all` holder mint an `all` grant', () => {
    const partial = scope({ grants: new Map([['Lead', new Set(['lead-1'])]]) });
    const full = scope({ grants: new Map([['Lead', 'all']]) });
    const request = {
      organizationId: 'org-1',
      resourceType: 'Lead',
      resourceId: null,
    };

    expect(canGrantScope(partial, request)).toBe(false);
    expect(canGrantScope(full, request)).toBe(true);
  });

  it('never crosses a tenant boundary', () => {
    const actor = scope({ grants: new Map([['Lead', 'all']]) });
    expect(
      canGrantScope(actor, {
        organizationId: 'org-2',
        resourceType: 'Lead',
        resourceId: null,
      }),
    ).toBe(false);
  });

  it('lets the platform tier through', () => {
    expect(
      canGrantScope(scope({ bypass: true }), {
        organizationId: 'org-2',
        resourceType: 'Lead',
        resourceId: null,
      }),
    ).toBe(true);
  });
});
