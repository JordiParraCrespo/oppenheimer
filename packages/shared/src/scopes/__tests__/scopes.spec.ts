import { describe, expect, it } from 'vitest';
import { defineAbilitiesFromPermissions } from '../../permissions';
import {
  DEFAULT_OAUTH_SCOPES,
  expandScopes,
  getPermissionGroup,
  grantableScopes,
  hasAllScopes,
  hasScope,
  isOrganizationAllowed,
  isScope,
  missingScopes,
  normalizeScopes,
  PERMISSION_GROUPS,
  parseScope,
  parseScopeString,
  SCOPE_ACCESS_LEVELS,
  SCOPE_RESOURCES,
  SCOPES,
  type Scope,
  scopesForPolicy,
  scopesFromRecord,
  scopesToRecord,
  sortScopes,
  stringifyScopes,
  toResourceScope,
  ungrantableScopes,
} from '../index';

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

  it('looks groups up by resource and rejects unknown ones', () => {
    expect(getPermissionGroup('users').label).toBe('Users');
    expect(() => getPermissionGroup('nope' as never)).toThrow(/Unknown permission group/);
  });

  it('defaults OAuth clients to the narrowest useful grant', () => {
    expect(DEFAULT_OAUTH_SCOPES).toEqual(['profile:read']);
  });
});

describe('isScope / parseScope', () => {
  it('accepts catalog scopes and rejects anything else', () => {
    expect(isScope('users:read')).toBe(true);
    expect(isScope('users:admin')).toBe(false);
    expect(isScope('nope:read')).toBe(false);
    expect(isScope('')).toBe(false);
    expect(isScope(null)).toBe(false);
    expect(isScope(42)).toBe(false);
  });

  it('splits a scope into resource and access level', () => {
    expect(parseScope('roles:write')).toEqual({
      resource: 'roles',
      access: 'write',
    });
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

describe('hasScope / hasAllScopes / missingScopes', () => {
  it('honours the write ⇒ read implication', () => {
    expect(hasScope(['users:write'], 'users:read')).toBe(true);
    expect(hasScope(['users:read'], 'users:write')).toBe(false);
  });

  it('requires every scope in the list', () => {
    expect(hasAllScopes(['users:write', 'roles:read'], ['users:read', 'roles:read'])).toBe(true);
    expect(hasAllScopes(['users:write'], ['users:read', 'roles:read'])).toBe(false);
  });

  it('treats an empty requirement as satisfied', () => {
    expect(hasAllScopes([], [])).toBe(true);
  });

  it('reports exactly what is missing', () => {
    expect(missingScopes(['users:read'], ['users:read', 'roles:write'])).toEqual(['roles:write']);
  });
});

describe('normalizeScopes / parseScopeString', () => {
  it('separates known scopes from junk and de-duplicates', () => {
    const result = normalizeScopes(['users:read', 'users:read', 'bogus', '', null, 7]);
    expect(result.scopes).toEqual(['users:read']);
    expect(result.unknown).toEqual(['bogus']);
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

  it('round-trips through the OAuth string form', () => {
    const scopes: Scope[] = ['roles:write', 'users:read'];
    expect(parseScopeString(stringifyScopes(scopes)).scopes).toEqual(sortScopes(scopes));
  });
});

describe('sortScopes', () => {
  it('orders scopes by catalog position, not alphabetically', () => {
    expect(sortScopes(['users:read', 'profile:read'])).toEqual(['profile:read', 'users:read']);
  });
});

describe('scopesToRecord / scopesFromRecord', () => {
  it('groups scopes by resource', () => {
    expect(scopesToRecord(['users:read', 'users:write', 'roles:read'])).toEqual({
      users: ['read', 'write'],
      roles: ['read'],
    });
  });

  it('round-trips', () => {
    const scopes: Scope[] = ['users:read', 'users:write', 'roles:read'];
    expect(scopesFromRecord(scopesToRecord(scopes))).toEqual(sortScopes(scopes));
  });

  it('drops unknown resources and levels rather than throwing', () => {
    expect(
      scopesFromRecord({
        users: ['read'],
        bogus: ['read'],
        roles: ['sideways'],
      }),
    ).toEqual(['users:read']);
  });

  it('tolerates null and undefined', () => {
    expect(scopesFromRecord(null)).toEqual([]);
    expect(scopesFromRecord(undefined)).toEqual([]);
  });
});

describe('scopesForPolicy', () => {
  it('maps a CASL rule back to the scopes that authorize it', () => {
    expect(scopesForPolicy({ action: 'read', subject: 'User' })).toEqual(['users:read']);
    expect(scopesForPolicy({ action: 'delete', subject: 'Role' })).toEqual(['roles:write']);
  });

  it('maps privileged user management to the admin group, not the directory', () => {
    expect(scopesForPolicy({ action: 'manage', subject: 'User' })).toEqual([
      'admin:read',
      'admin:write',
    ]);
  });

  it('returns nothing for a rule no scope backs', () => {
    expect(scopesForPolicy({ action: 'read', subject: 'Article' })).toEqual([]);
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

  it('grants a write level when the ability satisfies any one of its rules', () => {
    const ability = defineAbilitiesFromPermissions([{ action: 'update', subject: 'User' }]);
    expect(grantableScopes(ability)).toContain('users:write');
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
