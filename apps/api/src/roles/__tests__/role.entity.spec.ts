import { describe, expect, it } from 'vitest';
import { RoleEntity } from '../domain/role.entity';
import { Permission } from '../domain/value-objects/permission.value-object';

const manageAll = () => Permission.fromDefinition({ action: 'manage', subject: 'all' });
const readUser = () => Permission.fromDefinition({ action: 'read', subject: 'User' });

describe('RoleEntity full-access guard (admin lockout protection)', () => {
  it('detects `manage all` as full access', () => {
    expect(RoleEntity.grantsFullAccess([manageAll()])).toBe(true);
    expect(RoleEntity.grantsFullAccess([readUser()])).toBe(false);
    expect(RoleEntity.grantsFullAccess([])).toBe(false);
  });

  it('does not count an inverted `manage all` as full access', () => {
    const invertedManageAll = Permission.fromDefinition({
      action: 'manage',
      subject: 'all',
      inverted: true,
    });
    expect(RoleEntity.grantsFullAccess([invertedManageAll])).toBe(false);
  });

  it('reports whether a role instance currently grants full access', () => {
    const admin = RoleEntity.create({
      id: 'role-1',
      props: {
        name: 'admin',
        description: null,
        isSystem: true,
        organizationId: null,
        permissions: [manageAll()],
      },
    });
    const editor = RoleEntity.create({
      id: 'role-2',
      props: {
        name: 'editor',
        description: null,
        isSystem: false,
        organizationId: null,
        permissions: [readUser()],
      },
    });

    expect(admin.hasFullAccess()).toBe(true);
    expect(editor.hasFullAccess()).toBe(false);
  });
});
