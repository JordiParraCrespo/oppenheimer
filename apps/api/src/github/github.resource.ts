import { defineResource } from '@oppenheimer/backend-authz';

/**
 * The module's whole authorization surface: one subject, `Installation`, the
 * only row. Repositories and branches are listed live through the
 * installation's token, so the routes that list them check `read
 * Installation`, exactly the access GitHub is about to be asked to honour.
 *
 * `credentialScope` is `repositories`, the scope catalog's name for the group;
 * the vendor name stops at the directory
 * (`product/versions/mvp/03-control-plane.md`).
 */
export const InstallationResource = defineResource({
  subject: 'Installation',
  label: 'GitHub installations',
  group: 'github',

  actions: [
    { name: 'read', label: 'View connected installations and what they cover' },
    { name: 'create', label: 'Connect a GitHub App installation' },
    { name: 'delete', label: 'Disconnect a GitHub App installation' },
  ],

  keys: {
    organization: 'organizationId',
    id: 'id',
  },

  /**
   * Tenant isolation and nothing else. An installation is not a person's and
   * not a team's: it is what the workspace was granted, so every member of the
   * workspace who holds the action reaches all of them.
   */
  scopes: ['organization'],
  credentialScope: 'repositories',
});
