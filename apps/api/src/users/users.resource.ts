import { defineResource } from '@oppenheimer/backend-authz';

/**
 * The user directory. Not row-scoped: it is a platform-level resource guarded
 * at the route, so it declares no scope dimensions.
 */
export const UserResource = defineResource({
  subject: 'User',
  label: 'Users',
  group: 'platform',
  actions: [
    { name: 'read', label: 'View users' },
    { name: 'create', label: 'Create users' },
    { name: 'update', label: 'Edit users' },
    { name: 'delete', label: 'Delete users', sensitive: true },
    { name: 'manage', label: 'Full control', sensitive: true },
  ],
  keys: {},
  scopes: [],
  credentialScope: 'users',
});
