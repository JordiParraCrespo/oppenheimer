import { defineResource } from '@oppenheimer/backend-authz';

/**
 * A host is a **person's** machine: `ownerUserId` is the owner column and there is no
 * organization key at all. One laptop is paired once and every workspace its owner
 * is in borrows it, since the login in `~/.claude` is the person's
 * (`product/versions/mvp/08-auth.md`). With no `keys.organization`,
 * `applyAccessScope` skips the tenant clause and scopes by `own` or a grant alone, so
 * sharing a host with a teammate is an `access_grant` over `Host`, not a column.
 */
export const HostResource = defineResource({
  subject: 'Host',
  label: 'Hosts',
  group: 'control-plane',

  actions: [
    { name: 'read', label: 'View hosts' },
    { name: 'create', label: 'Pair a host' },
    { name: 'update', label: 'Rename a host' },
    { name: 'delete', label: 'Unpair a host' },
  ],

  keys: { owner: 'ownerUserId', id: 'id' },

  scopes: ['own', 'grant'],
  credentialScope: 'hosts',
});
