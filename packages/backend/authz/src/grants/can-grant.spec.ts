import {
  type AbilityContext,
  type AppAbility,
  defineAbilitiesFromPermissions,
  type PermissionDefinition,
  SYSTEM_ROLE_PERMISSIONS,
} from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import type { AccessScope } from '../scope/access-scope';
import { canGrant, describePermission, ungrantablePermissions } from './can-grant';
import { canGrantScope } from './can-grant-scope';

const abilityOf = (rules: Parameters<typeof defineAbilitiesFromPermissions>[0]) =>
  defineAbilitiesFromPermissions(rules);

describe('canGrant', () => {
  it('lets an actor grant what they already hold', () => {
    const actor = abilityOf([{ action: 'read', subject: 'Project' }]);
    expect(canGrant(actor, [{ action: 'read', subject: 'Project' }])).toBe(true);
  });

  it('blocks the escalation to `manage all`', () => {
    const actor = abilityOf([{ action: 'manage', subject: 'Role' }]);
    const requested = [{ action: 'manage', subject: 'all' }];

    expect(canGrant(actor, requested)).toBe(false);
    expect(ungrantablePermissions(actor, requested)).toEqual(requested);
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

describe('canGrant — conditions', () => {
  // The context the actor's ability is built with; the same one is handed to
  // the containment check so both sides are interpolated alike.
  const ctx: AbilityContext = { user: { id: 'u1' }, activeOrganizationId: 'org-A' };
  const actorWith = (rules: PermissionDefinition[]) => defineAbilitiesFromPermissions(rules, ctx);
  const grantable = (actor: AppAbility, rule: PermissionDefinition) => canGrant(actor, [rule], ctx);

  // biome-ignore lint/suspicious/noTemplateCurlyInString: a condition placeholder, not a template literal
  const ORG = '${activeOrganizationId}';
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a condition placeholder, not a template literal
  const ME = '${user.id}';
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a condition placeholder, not a template literal
  const UNRESOLVED = '${user.email}';
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a condition placeholder, not a template literal
  const ALL_SESSIONS = '${scope.grants.Session}';
  const owner = actorWith([
    { action: 'manage', subject: 'Session', conditions: { organizationId: ORG } },
  ]);

  it('does not let a conditioned rule cover an unconditioned request', () => {
    // The regression: a type-level `can('manage', 'Session')` is true for a
    // workspace owner, whose rule is scoped to their own organization.
    const requested: PermissionDefinition[] = [{ action: 'manage', subject: 'Session' }];
    expect(canGrant(owner, requested, ctx)).toBe(false);
    expect(ungrantablePermissions(owner, requested, ctx)).toEqual(requested);
  });

  it('accepts the same placeholder the actor holds', () => {
    expect(
      grantable(owner, {
        action: 'manage',
        subject: 'Session',
        conditions: { organizationId: ORG },
      }),
    ).toBe(true);
  });

  it('accepts the literal active organization and rejects another one', () => {
    expect(
      grantable(owner, {
        action: 'manage',
        subject: 'Session',
        conditions: { organizationId: 'org-A' },
      }),
    ).toBe(true);
    expect(
      grantable(owner, {
        action: 'manage',
        subject: 'Session',
        conditions: { organizationId: 'org-B' },
      }),
    ).toBe(false);
  });

  it('judges the placeholder in the context it is given', () => {
    const requested: PermissionDefinition[] = [
      { action: 'manage', subject: 'Session', conditions: { organizationId: ORG } },
    ];
    // Without the context the request's placeholder resolves to nothing.
    expect(canGrant(owner, requested)).toBe(false);
    // In another organization's context it names that organization.
    expect(canGrant(owner, requested, { ...ctx, activeOrganizationId: 'org-B' })).toBe(false);
  });

  it('rejects a condition on a subject the actor holds nothing for', () => {
    expect(
      grantable(owner, {
        action: 'manage',
        subject: 'Project',
        conditions: { organizationId: 'org-A' },
      }),
    ).toBe(false);
  });

  it('accepts a narrower request', () => {
    expect(
      grantable(owner, {
        action: 'manage',
        subject: 'Session',
        conditions: { organizationId: 'org-A', status: 'running' },
      }),
    ).toBe(true);
  });

  it('rejects a wider request', () => {
    const actor = actorWith([
      {
        action: 'manage',
        subject: 'Session',
        conditions: { organizationId: ORG, status: 'running' },
      },
    ]);
    expect(
      grantable(actor, {
        action: 'manage',
        subject: 'Session',
        conditions: { organizationId: 'org-A' },
      }),
    ).toBe(false);
  });

  it('scopes user-id placeholder rules to the actor', () => {
    const actor = actorWith([
      { action: 'manage', subject: 'Host', conditions: { ownerUserId: ME } },
    ]);

    expect(
      grantable(actor, { action: 'read', subject: 'Host', conditions: { ownerUserId: ME } }),
    ).toBe(true);
    expect(grantable(actor, { action: 'manage', subject: 'Host' })).toBe(false);
    expect(
      grantable(actor, { action: 'manage', subject: 'Host', conditions: { ownerUserId: 'u2' } }),
    ).toBe(false);
  });

  it('honours the `manage` alias in one direction only', () => {
    const reader = actorWith([
      { action: 'read', subject: 'Session', conditions: { organizationId: ORG } },
    ]);
    const conditions = { organizationId: ORG };

    expect(grantable(owner, { action: 'read', subject: 'Session', conditions })).toBe(true);
    expect(grantable(reader, { action: 'manage', subject: 'Session', conditions })).toBe(false);
  });

  it('lets `manage all` grant unconditioned and conditioned rules on any subject', () => {
    const admin = actorWith([{ action: 'manage', subject: 'all' }]);

    expect(grantable(admin, { action: 'manage', subject: 'Session' })).toBe(true);
    expect(grantable(admin, { action: 'export', subject: 'Project' })).toBe(true);
    expect(grantable(admin, { action: 'manage', subject: 'all' })).toBe(true);
    expect(
      grantable(admin, {
        action: 'read',
        subject: 'Project',
        conditions: { organizationId: 'org-B' },
      }),
    ).toBe(true);
    expect(
      grantable(admin, {
        action: 'read',
        subject: 'Session',
        conditions: { status: { $nin: ['archived'] } },
      }),
    ).toBe(true);
  });

  it('does not let a conditioned `manage all` grant unconditioned rules', () => {
    const actor = actorWith([
      { action: 'manage', subject: 'all', conditions: { organizationId: ORG } },
    ]);
    expect(grantable(actor, { action: 'manage', subject: 'all' })).toBe(false);
    expect(grantable(actor, { action: 'manage', subject: 'Session' })).toBe(false);
  });

  it('accepts operator conditions only when they deep-equal the actor rule', () => {
    const actor = actorWith([
      { action: 'read', subject: 'Session', conditions: { organizationId: { $in: ['org-A'] } } },
    ]);

    expect(
      grantable(actor, {
        action: 'read',
        subject: 'Session',
        conditions: { organizationId: { $in: ['org-A'] } },
      }),
    ).toBe(true);
    expect(
      grantable(actor, {
        action: 'read',
        subject: 'Session',
        conditions: { organizationId: { $in: ['org-A', 'org-B'] } },
      }),
    ).toBe(false);
    // An equality request inside the `$in` is narrower, so it passes too.
    expect(
      grantable(actor, {
        action: 'read',
        subject: 'Session',
        conditions: { organizationId: 'org-A' },
      }),
    ).toBe(true);
  });

  it('does not let a `$ne` rule match a request that omits the key', () => {
    const actor = actorWith([
      { action: 'read', subject: 'Session', conditions: { status: { $ne: 'archived' } } },
    ]);

    expect(
      grantable(actor, {
        action: 'read',
        subject: 'Session',
        conditions: { organizationId: 'org-A' },
      }),
    ).toBe(false);
    expect(
      grantable(actor, {
        action: 'read',
        subject: 'Session',
        conditions: { organizationId: 'org-A', status: 'archived' },
      }),
    ).toBe(false);
    expect(
      grantable(actor, {
        action: 'read',
        subject: 'Session',
        conditions: { organizationId: 'org-A', status: 'running' },
      }),
    ).toBe(true);
  });

  it('does not let a `$ne` or `$nin` request slip past an equality rule', () => {
    expect(
      grantable(owner, {
        action: 'read',
        subject: 'Session',
        conditions: { organizationId: { $nin: ['org-B'] } },
      }),
    ).toBe(false);
    expect(
      grantable(owner, {
        action: 'read',
        subject: 'Session',
        conditions: { organizationId: { $ne: 'org-B' } },
      }),
    ).toBe(false);
  });

  it('rejects `$or` and nested-path requests that do not match exactly', () => {
    expect(
      grantable(owner, {
        action: 'read',
        subject: 'Session',
        conditions: { $or: [{ organizationId: 'org-A' }, { organizationId: 'org-B' }] },
      }),
    ).toBe(false);
    expect(
      grantable(owner, {
        action: 'read',
        subject: 'Session',
        conditions: { organizationId: 'org-A', 'owner.id': 'u1' },
      }),
    ).toBe(false);
  });

  it('treats an empty conditions object as unconditioned', () => {
    expect(grantable(owner, { action: 'read', subject: 'Session', conditions: {} })).toBe(false);
  });

  it('rejects what a conditioned deny on the actor might remove', () => {
    const actor = actorWith([
      { action: 'manage', subject: 'Session' },
      { action: 'delete', subject: 'Session', inverted: true, conditions: { locked: true } },
    ]);

    expect(grantable(actor, { action: 'delete', subject: 'Session' })).toBe(false);
    expect(grantable(actor, { action: 'read', subject: 'Session' })).toBe(true);
  });

  it('checks fields and conditions together', () => {
    const actor = actorWith([
      {
        action: 'read',
        subject: 'Project',
        fields: ['name'],
        conditions: { organizationId: ORG },
      },
    ]);
    const conditions = { organizationId: ORG };

    expect(
      grantable(actor, { action: 'read', subject: 'Project', fields: ['name'], conditions }),
    ).toBe(true);
    expect(
      grantable(actor, { action: 'read', subject: 'Project', fields: ['repoUrl'], conditions }),
    ).toBe(false);
    // A field-limited rule does not cover the whole subject…
    expect(grantable(actor, { action: 'read', subject: 'Project', conditions })).toBe(false);
    // …and a conditioned one does not cover the field everywhere.
    expect(grantable(actor, { action: 'read', subject: 'Project', fields: ['name'] })).toBe(false);
  });

  it('rejects the whole subject when the actor is denied one field of it', () => {
    const actor = actorWith([
      { action: 'read', subject: 'Lead' },
      { action: 'read', subject: 'Lead', fields: ['value'], inverted: true },
    ]);
    expect(grantable(actor, { action: 'read', subject: 'Lead' })).toBe(false);
  });

  it('rejects a placeholder the context cannot resolve', () => {
    const requested: PermissionDefinition = {
      action: 'read',
      subject: 'Host',
      conditions: { ownerEmail: UNRESOLVED },
    };
    const sameUnresolved = actorWith([
      { action: 'read', subject: 'Host', conditions: { ownerEmail: UNRESOLVED } },
    ]);

    expect(grantable(owner, requested)).toBe(false);
    // Not even against an actor rule carrying the same unresolved placeholder.
    expect(grantable(sameUnresolved, requested)).toBe(false);
  });

  it('rejects a request that collapses to unrestricted through an `all` scope grant', () => {
    const scoped: AbilityContext = { ...ctx, scope: { grants: { Session: 'all' } } };
    const actor = defineAbilitiesFromPermissions(
      [{ action: 'read', subject: 'Session', conditions: { organizationId: ORG } }],
      scoped,
    );
    const requested: PermissionDefinition[] = [
      {
        action: 'read',
        subject: 'Session',
        conditions: { id: { $in: ALL_SESSIONS } },
      },
    ];

    expect(canGrant(actor, requested, scoped)).toBe(false);
  });

  it('lets the seeded owner grant its own rules and nothing wider', () => {
    const tenantOwner = actorWith(SYSTEM_ROLE_PERMISSIONS.owner);

    expect(canGrant(tenantOwner, SYSTEM_ROLE_PERMISSIONS.owner, ctx)).toBe(true);
    expect(canGrant(tenantOwner, SYSTEM_ROLE_PERMISSIONS.admin, ctx)).toBe(false);
    expect(
      ungrantablePermissions(
        tenantOwner,
        [
          { action: 'manage', subject: 'Session' },
          { action: 'manage', subject: 'Role' },
          { action: 'manage', subject: 'Project', conditions: { organizationId: 'org-B' } },
          { action: 'read', subject: 'Session', conditions: { organizationId: ORG } },
        ],
        ctx,
      ),
    ).toEqual([
      { action: 'manage', subject: 'Session' },
      { action: 'manage', subject: 'Role' },
      { action: 'manage', subject: 'Project', conditions: { organizationId: 'org-B' } },
    ]);
  });

  it('lets `manage all` grant the conditioned owner role', () => {
    const admin = actorWith([{ action: 'manage', subject: 'all' }]);
    expect(canGrant(admin, SYSTEM_ROLE_PERMISSIONS.owner, ctx)).toBe(true);
  });
});

describe('describePermission', () => {
  it('renders fields and conditions', () => {
    expect(describePermission({ action: 'read', subject: 'Lead' })).toBe('read Lead');
    expect(
      describePermission({
        action: 'read',
        subject: 'Project',
        fields: ['name'],
        conditions: { organizationId: 'org-A' },
      }),
    ).toBe('read Project (name) where {"organizationId":"org-A"}');
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
