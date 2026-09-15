import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Role definitions themselves. Editing these is how every other capability is
 * granted, so `update` is the most privileged action in the catalog — the
 * containment check in `canGrant` is what stops it becoming an escalation.
 */
export const RoleResource = defineResource({
  subject: 'Role',
  label: 'Roles',
  group: 'platform',
  actions: [
    { name: 'read', label: 'View roles' },
    { name: 'create', label: 'Create roles' },
    { name: 'update', label: 'Edit roles and their permissions', sensitive: true },
    { name: 'delete', label: 'Delete roles', sensitive: true },
  ],
  keys: {},
  scopes: [],
  credentialScope: 'roles',
});
