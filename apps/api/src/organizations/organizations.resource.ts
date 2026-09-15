import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Organizations and the membership machinery around them.
 *
 * These tables are owned by the Better Auth organization plugin, so the
 * declarations exist for the role builder and the credential catalog rather
 * than for row filtering — the façade delegates to `auth.api.*`, which applies
 * its own membership rules. They therefore declare no scope dimensions.
 */
export const OrganizationResource = defineResource({
  subject: 'Organization',
  label: 'Organizations',
  group: 'organization',
  actions: [
    { name: 'read', label: 'View organizations' },
    { name: 'create', label: 'Create organizations' },
    { name: 'update', label: 'Edit organization settings' },
    { name: 'delete', label: 'Delete an organization', sensitive: true },
  ],
  keys: {},
  scopes: [],
  credentialScope: 'organizations',
});

export const MemberResource = defineResource({
  subject: 'Member',
  label: 'Members',
  group: 'organization',
  actions: [
    { name: 'read', label: 'View members' },
    { name: 'create', label: 'Add members' },
    { name: 'update', label: 'Change a member’s organization role' },
    { name: 'delete', label: 'Remove members' },
    { name: 'manage', label: 'Full control', sensitive: true },
  ],
  keys: {},
  scopes: [],
  credentialScope: 'members',
});

export const InvitationResource = defineResource({
  subject: 'Invitation',
  label: 'Invitations',
  group: 'organization',
  actions: [
    { name: 'read', label: 'View invitations' },
    { name: 'create', label: 'Send invitations' },
    { name: 'delete', label: 'Cancel invitations' },
  ],
  keys: {},
  scopes: [],
  credentialScope: 'invitations',
});

export const WorkspaceResource = defineResource({
  subject: 'Workspace',
  label: 'Workspaces',
  group: 'organization',
  actions: [
    { name: 'read', label: 'View workspaces' },
    { name: 'create', label: 'Create workspaces' },
    { name: 'update', label: 'Rename workspaces' },
    { name: 'delete', label: 'Delete workspaces' },
    { name: 'manage', label: 'Full control', sensitive: true },
  ],
  keys: { organization: 'organizationId' },
  scopes: [],
  credentialScope: 'workspaces',
});

export const ORGANIZATION_RESOURCES = [
  OrganizationResource,
  MemberResource,
  InvitationResource,
  WorkspaceResource,
];
