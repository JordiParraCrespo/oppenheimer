import { describe, expect, it } from 'vitest';
import {
  defineAbilitiesFromPermissions,
  KNOWN_ACTIONS,
  KNOWN_SUBJECTS,
  SYSTEM_ROLE_PERMISSIONS,
} from '../../permissions/index.js';
import {
  DEFAULT_OAUTH_SCOPES,
  expandScopes,
  grantableScopes,
  isOrganizationAllowed,
  missingScopes,
  normalizeScopes,
  PERMISSION_GROUPS,
  parseScopeString,
  SCOPE_ACCESS_LEVELS,
  SCOPE_RESOURCES,
  SCOPES,
  sortScopes,
  toResourceScope,
  ungrantableScopes,
} from '../index.js';

describe('scope catalog', () => {
  it('exposes one group per resource, each with both access levels', () => {
    expect(PERMISSION_GROUPS).toHaveLength(SCOPE_RESOURCES.length);
    expect(SCOPES).toHaveLength(SCOPE_RESOURCES.length * SCOPE_ACCESS_LEVELS.length);

    for (const group of PERMISSION_GROUPS) {
      for (const level of SCOPE_ACCESS_LEVELS) {
        expect(group.levels[level].scope).toBe(`${group.resource}:${level}`);
      }
    }
  });

  it('has no duplicate scopes', () => {
    expect(new Set(SCOPES).size).toBe(SCOPES.length);
  });

  it('defaults OAuth clients to the narrowest useful grant', () => {
    expect(DEFAULT_OAUTH_SCOPES).toEqual(['profile:read']);
  });

  it('backs every level with at least one CASL rule, except the caller’s own profile', () => {
    for (const group of PERMISSION_GROUPS) {
      for (const level of SCOPE_ACCESS_LEVELS) {
        const { policies } = group.levels[level];
        if (group.resource === 'profile') expect(policies).toEqual([]);
        else expect(policies.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('the control plane’s scopes', () => {
  it('uses only actions and subjects the seed and the role UI know', () => {
    for (const group of PERMISSION_GROUPS) {
      for (const level of SCOPE_ACCESS_LEVELS) {
        for (const policy of group.levels[level].policies) {
          expect(KNOWN_ACTIONS).toContain(policy.action);
          expect(KNOWN_SUBJECTS).toContain(policy.subject);
        }
      }
    }
  });

  it('lets a workspace owner grant every workspace-owned resource but not hosts', () => {
    const ability = defineAbilitiesFromPermissions(SYSTEM_ROLE_PERMISSIONS.owner, {
      activeOrganizationId: 'org-1',
    });
    const grantable = grantableScopes(ability);
    expect(grantable).toContain('projects:write');
    expect(grantable).toContain('sessions:write');
    expect(grantable).toContain('repositories:write');
    expect(grantable).not.toContain('hosts:read');
  });

  it('lets a person grant their own hosts, because a host is theirs and not a workspace’s', () => {
    const ability = defineAbilitiesFromPermissions(SYSTEM_ROLE_PERMISSIONS.user, {
      user: { id: 'me' },
    });
    const grantable = grantableScopes(ability);
    expect(grantable).toContain('hosts:read');
    expect(grantable).toContain('hosts:write');
  });

  /**
   * The seed changes exactly two roles, and this is the whole story rather than
   * half of it. A plain account can grant its own hosts and nothing else new; an
   * owner can grant the workspace's work but not a machine. There is **no
   * `member` entry in `SYSTEM_ROLE_PERMISSIONS` at all**, so a teammate invited
   * into a workspace is granted nothing by the seed — asserted here so the gap
   * is a recorded fact and not a discovery.
   */
  it('tells the three roles apart, and records that `member` is not seeded', () => {
    const workspaceScopes = ['projects:read', 'sessions:read', 'repositories:read'] as const;

    const user = grantableScopes(
      defineAbilitiesFromPermissions(SYSTEM_ROLE_PERMISSIONS.user, { user: { id: 'me' } }),
    );
    for (const scope of workspaceScopes) expect(user).not.toContain(scope);
    expect(user).toContain('hosts:write');

    const owner = grantableScopes(
      defineAbilitiesFromPermissions(SYSTEM_ROLE_PERMISSIONS.owner, {
        activeOrganizationId: 'org-1',
      }),
    );
    for (const scope of workspaceScopes) expect(owner).toContain(scope);
    expect(owner).not.toContain('hosts:write');

    expect(SYSTEM_ROLE_PERMISSIONS.member).toBeUndefined();
  });
});

describe('expandScopes', () => {
  it('makes write imply read on the same resource', () => {
    expect([...expandScopes(['users:write'])].sort()).toEqual(['users:read', 'users:write']);
  });

  it('does not leak the implication across resources', () => {
    expect(expandScopes(['users:write']).has('roles:read')).toBe(false);
  });

  it('is a no-op for read scopes', () => {
    expect([...expandScopes(['users:read'])]).toEqual(['users:read']);
  });
});

describe('missingScopes', () => {
  it('honours the write ⇒ read implication, never the reverse', () => {
    expect(missingScopes(['users:write'], ['users:read'])).toEqual([]);
    // What keeps a read-only credential off a PTY is the level, not the verb.
    expect(missingScopes(['sessions:read'], ['sessions:write'])).toEqual(['sessions:write']);
  });

  it('reports exactly what is missing', () => {
    expect(missingScopes(['users:read'], ['users:read', 'roles:write'])).toEqual(['roles:write']);
    expect(missingScopes(['users:write', 'roles:read'], ['users:read', 'roles:read'])).toEqual([]);
  });
});

describe('normalizeScopes / parseScopeString', () => {
  it('separates known scopes from junk and de-duplicates', () => {
    const result = normalizeScopes([
      'users:read',
      'users:read',
      'bogus',
      'users:admin',
      '',
      null,
      7,
    ]);
    expect(result.scopes).toEqual(['users:read']);
    expect(result.unknown).toEqual(['bogus', 'users:admin']);
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeScopes(['  roles:write  ']).scopes).toEqual(['roles:write']);
  });

  it('parses space- and comma-separated OAuth scope strings', () => {
    expect(parseScopeString('users:read roles:write').scopes).toEqual([
      'users:read',
      'roles:write',
    ]);
    expect(parseScopeString('users:read,roles:write').scopes).toEqual([
      'users:read',
      'roles:write',
    ]);
    expect(parseScopeString(null).scopes).toEqual([]);
    expect(parseScopeString(undefined).scopes).toEqual([]);
  });
});

describe('sortScopes', () => {
  it('orders scopes by catalog position, not alphabetically', () => {
    expect(sortScopes(['users:read', 'profile:read'])).toEqual(['profile:read', 'users:read']);
  });
});

describe('grantableScopes', () => {
  it('lets an admin grant the whole catalog', () => {
    const ability = defineAbilitiesFromPermissions([{ action: 'manage', subject: 'all' }]);
    expect(grantableScopes(ability)).toEqual([...SCOPES]);
  });

  it('limits a reader to the read levels they hold, plus their own profile', () => {
    const ability = defineAbilitiesFromPermissions([{ action: 'read', subject: 'User' }]);
    expect(grantableScopes(ability)).toEqual(['profile:read', 'profile:write', 'users:read']);
  });

  it('always allows the profile group — it governs the caller’s own account', () => {
    const ability = defineAbilitiesFromPermissions([]);
    expect(grantableScopes(ability)).toEqual(['profile:read', 'profile:write']);
  });

  it('grants a write level when the ability satisfies any one of its rules, and no further', () => {
    const ability = defineAbilitiesFromPermissions([{ action: 'update', subject: 'User' }]);
    expect(grantableScopes(ability)).toContain('users:write');
    // Editing the directory is not account takeover: the admin group needs `manage User`.
    expect(grantableScopes(ability)).not.toContain('admin:write');
  });

  it('does not let a directory reader reach the admin group', () => {
    const ability = defineAbilitiesFromPermissions([{ action: 'read', subject: 'User' }]);
    expect(grantableScopes(ability)).not.toContain('admin:read');
  });

  it('reports which requested scopes exceed the granter', () => {
    const ability = defineAbilitiesFromPermissions([{ action: 'read', subject: 'User' }]);
    expect(ungrantableScopes(ability, ['users:read', 'roles:write'])).toEqual(['roles:write']);
  });
});

describe('resource scoping', () => {
  it('treats an empty or missing list as unrestricted', () => {
    expect(toResourceScope(undefined).organizationIds).toBeNull();
    expect(toResourceScope([]).organizationIds).toBeNull();
  });

  it('de-duplicates and sorts the organization list', () => {
    expect(toResourceScope(['b', 'a', 'b']).organizationIds).toEqual(['a', 'b']);
  });

  it('allows any organization when unrestricted', () => {
    expect(isOrganizationAllowed(toResourceScope(null), 'org-1')).toBe(true);
  });

  it('allows only the listed organizations when restricted', () => {
    const scope = toResourceScope(['org-1']);
    expect(isOrganizationAllowed(scope, 'org-1')).toBe(true);
    expect(isOrganizationAllowed(scope, 'org-2')).toBe(false);
  });

  it('allows requests that are not organization-bound', () => {
    expect(isOrganizationAllowed(toResourceScope(['org-1']), null)).toBe(true);
  });
});
