import { defineResource } from '@oppenheimer/backend-authz';

/**
 * The module's whole authorization surface.
 *
 * One subject, because there is only one row: `Installation`. Repositories and
 * branches are listed live through the installation's own token, so they are
 * not a resource of ours — the routes that list them check `read Installation`,
 * which is exactly the access GitHub is about to be asked to honour.
 *
 * `credentialScope` is `repositories` because that is what the scope catalog
 * calls the group an API token or MCP client asks for; the vendor name stops at
 * the directory (`product/versions/mvp/03-control-plane.md`).
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

  /** The columns each scope dimension filters on. */
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
