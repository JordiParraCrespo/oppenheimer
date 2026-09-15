import type { Actions, Subjects } from '../permissions';

/**
 * Access levels a permission group can be granted at. `write` always implies
 * `read` (see `expandScopes`), mirroring the "Edit implies Read" convention
 * users already expect from provider consoles.
 */
export const SCOPE_ACCESS_LEVELS = ['read', 'write'] as const;
export type ScopeAccessLevel = (typeof SCOPE_ACCESS_LEVELS)[number];

/**
 * The resources a credential can be scoped to. One entry per permission group
 * shown on the token-creation and OAuth consent screens.
 */
export const SCOPE_RESOURCES = [
  'profile',
  'users',
  'admin',
  'roles',
  'organizations',
  'members',
  'invitations',
  'workspaces',
  'tokens',
  'billing',
  'leads',
] as const;
export type ScopeResource = (typeof SCOPE_RESOURCES)[number];

/** A single permission, e.g. `users:read`. */
export type Scope = `${ScopeResource}:${ScopeAccessLevel}`;

/** A CASL rule, in the same shape the `@CheckPolicies` route decorator takes. */
export interface ScopePolicy {
  action: Actions;
  subject: Subjects;
}

export interface ScopeLevelDefinition {
  scope: Scope;
  label: string;
  description: string;
  /**
   * CASL rules backing this level. A user may only grant the scope if their
   * own ability satisfies at least one of them — a token can never be minted
   * with more reach than its creator has. At request time the route's own
   * `@CheckPolicies` rule is still evaluated against the owner's live ability,
   * so revoking a role immediately narrows every token they issued.
   *
   * Empty means the level is not backed by a policy: it governs the caller's
   * own account, which every authenticated principal may access.
   */
  policies: readonly ScopePolicy[];
}

export interface PermissionGroup {
  resource: ScopeResource;
  label: string;
  description: string;
  /**
   * Marks groups that grant account-takeover-adjacent powers (impersonation,
   * password resets, minting further credentials). Consent and token screens
   * call these out; nothing in the enforcement path treats them differently.
   */
  sensitive?: boolean;
  levels: Record<ScopeAccessLevel, ScopeLevelDefinition>;
}

/**
 * The permission catalog — the single source of truth shared by the API guard,
 * the MCP tool registry, the CLI and the web permission picker. Adding a
 * resource here is the only step needed for it to appear on every surface.
 */
export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    resource: 'profile',
    label: 'Profile',
    description: "The credential owner's own account.",
    levels: {
      read: {
        scope: 'profile:read',
        label: 'Read',
        description: "Read the owner's own profile.",
        policies: [],
      },
      write: {
        scope: 'profile:write',
        label: 'Edit',
        description: "Update the owner's own profile.",
        policies: [],
      },
    },
  },
  {
    resource: 'users',
    label: 'Users',
    description: 'The user directory.',
    levels: {
      read: {
        scope: 'users:read',
        label: 'Read',
        description: 'List and read user records.',
        policies: [{ action: 'read', subject: 'User' }],
      },
      write: {
        scope: 'users:write',
        label: 'Edit',
        description: 'Update and delete user records.',
        policies: [
          { action: 'create', subject: 'User' },
          { action: 'update', subject: 'User' },
          { action: 'delete', subject: 'User' },
        ],
      },
    },
  },
  {
    resource: 'admin',
    label: 'User administration',
    description:
      'Privileged account operations: bans, impersonation, password resets and session revocation.',
    sensitive: true,
    levels: {
      read: {
        scope: 'admin:read',
        label: 'Read',
        description: 'List users through the admin API and inspect their sessions.',
        policies: [{ action: 'manage', subject: 'User' }],
      },
      write: {
        scope: 'admin:write',
        label: 'Edit',
        description:
          'Ban, unban, impersonate, set passwords, assign global roles and revoke sessions.',
        policies: [{ action: 'manage', subject: 'User' }],
      },
    },
  },
  {
    resource: 'roles',
    label: 'Roles & permissions',
    description: 'Role definitions and the permissions attached to them.',
    sensitive: true,
    levels: {
      read: {
        scope: 'roles:read',
        label: 'Read',
        description: 'List roles and their permissions.',
        policies: [{ action: 'read', subject: 'Role' }],
      },
      write: {
        scope: 'roles:write',
        label: 'Edit',
        description: 'Create, edit and delete roles, and assign them to users.',
        policies: [
          { action: 'create', subject: 'Role' },
          { action: 'update', subject: 'Role' },
          { action: 'delete', subject: 'Role' },
        ],
      },
    },
  },
  {
    resource: 'organizations',
    label: 'Organizations',
    description: 'Organizations the credential owner belongs to.',
    levels: {
      read: {
        scope: 'organizations:read',
        label: 'Read',
        description: 'List and read organizations.',
        policies: [{ action: 'read', subject: 'Organization' }],
      },
      write: {
        scope: 'organizations:write',
        label: 'Edit',
        description: 'Create, update and delete organizations.',
        policies: [
          { action: 'create', subject: 'Organization' },
          { action: 'update', subject: 'Organization' },
          { action: 'delete', subject: 'Organization' },
        ],
      },
    },
  },
  {
    resource: 'members',
    label: 'Members',
    description: 'Organization membership and member roles.',
    levels: {
      read: {
        scope: 'members:read',
        label: 'Read',
        description: 'List organization members.',
        policies: [{ action: 'read', subject: 'Member' }],
      },
      write: {
        scope: 'members:write',
        label: 'Edit',
        description: 'Add members, change their organization role and remove them.',
        policies: [
          { action: 'create', subject: 'Member' },
          { action: 'update', subject: 'Member' },
          { action: 'delete', subject: 'Member' },
        ],
      },
    },
  },
  {
    resource: 'invitations',
    label: 'Invitations',
    description: 'Pending organization invitations.',
    levels: {
      read: {
        scope: 'invitations:read',
        label: 'Read',
        description: 'List pending invitations.',
        policies: [{ action: 'read', subject: 'Invitation' }],
      },
      write: {
        scope: 'invitations:write',
        label: 'Edit',
        description: 'Send, accept, reject and cancel invitations.',
        policies: [
          { action: 'create', subject: 'Invitation' },
          { action: 'update', subject: 'Invitation' },
        ],
      },
    },
  },
  {
    resource: 'workspaces',
    label: 'Workspaces',
    description: 'Workspaces (teams) inside an organization.',
    levels: {
      read: {
        scope: 'workspaces:read',
        label: 'Read',
        description: 'List and read workspaces and their members.',
        policies: [{ action: 'read', subject: 'Workspace' }],
      },
      write: {
        scope: 'workspaces:write',
        label: 'Edit',
        description: 'Create, update and delete workspaces and manage their members.',
        policies: [
          { action: 'create', subject: 'Workspace' },
          { action: 'update', subject: 'Workspace' },
          { action: 'delete', subject: 'Workspace' },
        ],
      },
    },
  },
  {
    resource: 'tokens',
    label: 'API tokens',
    description: "The credential owner's own API tokens.",
    sensitive: true,
    levels: {
      read: {
        scope: 'tokens:read',
        label: 'Read',
        description: 'List the owner’s API tokens (never their secrets).',
        policies: [{ action: 'read', subject: 'ApiToken' }],
      },
      write: {
        scope: 'tokens:write',
        label: 'Edit',
        description: 'Mint and revoke API tokens on the owner’s behalf.',
        policies: [
          { action: 'create', subject: 'ApiToken' },
          { action: 'delete', subject: 'ApiToken' },
        ],
      },
    },
  },
  {
    resource: 'billing',
    label: 'Billing',
    description: 'Subscriptions, checkout and the customer portal.',
    levels: {
      read: {
        scope: 'billing:read',
        label: 'Read',
        description: 'Read subscriptions and revenue metrics.',
        policies: [{ action: 'read', subject: 'Billing' }],
      },
      write: {
        scope: 'billing:write',
        label: 'Edit',
        description: 'Start a checkout session and open the customer portal.',
        policies: [{ action: 'manage', subject: 'Billing' }],
      },
    },
  },
  {
    resource: 'leads',
    label: 'Leads',
    description: 'The CRM lead records the caller can reach.',
    levels: {
      read: {
        scope: 'leads:read',
        label: 'Read',
        description: 'Browse and export leads within your scope.',
        policies: [{ action: 'read', subject: 'Lead' }],
      },
      write: {
        scope: 'leads:write',
        label: 'Edit',
        description: 'Create, edit and delete leads within your scope.',
        policies: [{ action: 'update', subject: 'Lead' }],
      },
    },
  },
];

/** Every scope in the catalog, in display order. */
export const SCOPES: readonly Scope[] = PERMISSION_GROUPS.flatMap((group) =>
  SCOPE_ACCESS_LEVELS.map((level) => group.levels[level].scope),
);

/**
 * Granted to an OAuth client that asks for nothing specific. Deliberately the
 * narrowest useful grant: identify the user, nothing more.
 */
export const DEFAULT_OAUTH_SCOPES: readonly Scope[] = ['profile:read'];

const GROUPS_BY_RESOURCE = new Map<ScopeResource, PermissionGroup>(
  PERMISSION_GROUPS.map((group) => [group.resource, group]),
);

/** Look up a permission group by its resource name. */
export function getPermissionGroup(resource: ScopeResource): PermissionGroup {
  const group = GROUPS_BY_RESOURCE.get(resource);
  if (!group) throw new Error(`Unknown permission group: ${resource}`);
  return group;
}
