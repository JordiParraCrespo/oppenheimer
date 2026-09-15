import { canAccessRow } from '@oppenheimer/backend-authz';
import { defineAbilitiesFromPermissions } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';

describe('defineAbilitiesFromPermissions', () => {
  it('grants full access for a `manage all` rule', () => {
    const ability = defineAbilitiesFromPermissions([{ action: 'manage', subject: 'all' }]);

    expect(ability.can('read', 'User')).toBe(true);
    expect(ability.can('delete', 'Role')).toBe(true);
  });

  it('unions multiple rules and respects the action/subject pair', () => {
    const ability = defineAbilitiesFromPermissions([
      { action: 'read', subject: 'User' },
      { action: 'create', subject: 'Article' },
    ]);

    expect(ability.can('read', 'User')).toBe(true);
    expect(ability.can('create', 'Article')).toBe(true);
    expect(ability.can('delete', 'User')).toBe(false);
  });

  it('interpolates user-id placeholder conditions for resource scoping', () => {
    const ability = defineAbilitiesFromPermissions(
      [
        {
          action: 'update',
          subject: 'Article',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: literal placeholder interpolated at runtime
          conditions: { authorId: '${user.id}' },
        },
      ],
      { user: { id: 'user-1' } },
    );

    expect(canAccessRow(ability, 'update', 'Article', { authorId: 'user-1' })).toBe(true);
    expect(canAccessRow(ability, 'update', 'Article', { authorId: 'user-2' })).toBe(false);
  });

  it('interpolates the active-organization placeholder for tenant scoping', () => {
    const ability = defineAbilitiesFromPermissions(
      [
        {
          action: 'read',
          subject: 'Article',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: literal placeholder interpolated at runtime
          conditions: { organizationId: '${activeOrganizationId}' },
        },
      ],
      { user: { id: 'user-1' }, activeOrganizationId: 'org-1' },
    );

    expect(canAccessRow(ability, 'read', 'Article', { organizationId: 'org-1' })).toBe(true);
    expect(canAccessRow(ability, 'read', 'Article', { organizationId: 'org-2' })).toBe(false);
  });

  it('applies inverted rules as `cannot`', () => {
    const ability = defineAbilitiesFromPermissions([
      { action: 'manage', subject: 'all' },
      { action: 'delete', subject: 'User', inverted: true },
    ]);

    expect(ability.can('read', 'User')).toBe(true);
    expect(ability.can('delete', 'User')).toBe(false);
  });
});
