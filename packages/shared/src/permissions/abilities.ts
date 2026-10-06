import {
  AbilityBuilder,
  type AnyMongoAbility,
  createMongoAbility,
  type MongoAbility,
  type MongoQuery,
  subject as tagSubject,
} from '@casl/ability';
import type { Role } from '../types/index.js';

/**
 * Instance-level permission check: does `ability` allow `action` on this
 * concrete row?
 *
 * `ability.can('read', 'User')` only answers the type-level question a route
 * guard asks. A rule scoped with `conditions` — `{ id: '${user.id}' }` — can
 * only be decided against a loaded record, which is what this evaluates.
 *
 * It lives here, beside the builder, for two reasons: consumers get a typed
 * call instead of importing `@casl/ability` themselves (a second copy of CASL
 * would silently break `instanceof` checks), and the one cast this needs stays
 * in the package that owns the ability's typing. The cast is required because
 * `Subjects` is a free-form `string` — rules are declared against a type name —
 * while a check may also pass a tagged row.
 */
export function canAccess(
  ability: AppAbility,
  action: Actions,
  subjectType: string,
  instance: Record<string, unknown>,
): boolean {
  return (ability as AnyMongoAbility).can(action, tagSubject(subjectType, instance));
}

/**
 * Actions and subjects are free-form strings: admins define roles and their
 * permissions at runtime, so the catalog is open-ended rather than a closed
 * union. The well-known values below are exported for convenience (seeding,
 * UI) without constraining what can be stored.
 */
export type Actions = string;
export type Subjects = string;

/** Built-in actions used by the seeded system roles. */
export const KNOWN_ACTIONS = ['create', 'read', 'update', 'delete', 'manage'] as const;
/** Built-in subjects used by the seeded system roles. `all` is CASL's wildcard. */
export const KNOWN_SUBJECTS = [
  'User',
  'Role',
  'Organization',
  'Workspace',
  'Member',
  'Invitation',
  'ApiToken',
  'AuditLog',
  'FeatureFlag',
  // The control plane's own nouns. `Host` is person-owned; the other three are
  // workspace-owned. There is deliberately no `Repository` subject: a repository
  // has no row, and the thing that *is* a row and *does* carry the tenant is the
  // installation, so the routes that list repositories check `read Installation`.
  // Two subjects for one boundary is how the conditions stop meaning anything.
  'Host',
  'Project',
  'Session',
  'Installation',
  // Workspace-owned, like sessions: an automation is a saved prompt the
  // workspace runs, and each of its runs is a session.
  'Automation',
  // Plan (`product/versions/mvp/17-plan.md`), workspace-owned like the rest:
  // `Task` covers tasks, their goals and their links to sessions; `Calendar`
  // the workspace's own events and a person's Google Calendar connection.
  'Task',
  'Calendar',
  // The Pull requests area: GitHub's pull requests, read and reviewed through
  // the workspace's installations, and a person's watched repositories.
  'PullRequest',
  'all',
] as const;

export type AppAbility = MongoAbility<[Actions, Subjects]>;

/**
 * A single CASL rule as stored on a role. `conditions` enables resource
 * scoping (e.g. `{ authorId: '${user.id}' }` — only own resources); the
 * `${...}` placeholders are interpolated against the request context when the
 * ability is built. `inverted` turns the rule into a `cannot`, `fields`
 * restricts it to specific attributes.
 */
export interface PermissionDefinition {
  action: Actions;
  subject: Subjects;
  conditions?: Record<string, unknown>;
  fields?: string[];
  inverted?: boolean;
  /** Human-readable explanation surfaced when the rule denies access. */
  reason?: string;
}

/**
 * Context made available to `${...}` placeholders in permission conditions.
 *
 * `user` powers own-resource scoping (`${user.id}`); `activeOrganizationId`
 * powers tenant scoping (`${activeOrganizationId}`).
 */
export interface AbilityContext {
  user?: Record<string, unknown> | null;
  /** The caller's active organization (from `session.activeOrganizationId`). */
  activeOrganizationId?: string | null;
  /** The caller's active workspace/team (from `session.activeTeamId`). */
  activeTeamId?: string | null;
  /** The caller's resolved access scope, for `${scope.*}` placeholders. */
  scope?: AbilityScopeContext;
}

/** Grants the caller holds over one resource type: specific ids, or all of them. */
export type ScopeGrant = readonly string[] | 'all';

/**
 * The scope half of the ability context. Mirrors the backend's `AccessScope`
 * without depending on it — this package must stay free of server concerns.
 *
 * The array-valued members are what make set-membership scoping expressible as
 * a CASL condition (`{ teamId: { $in: '${scope.teamIds}' } }`), which is what
 * keeps `ability.can()` honest about rows the caller cannot actually reach.
 */
export interface AbilityScopeContext {
  organizationId?: string | null;
  /** Teams the caller belongs to in the active organization. */
  teamIds?: readonly string[];
  /** Explicit grants, keyed by resource subject. */
  grants?: Readonly<Record<string, ScopeGrant>>;
}

const PLACEHOLDER = /^\$\{([^}]+)\}$/;

/**
 * Marks a placeholder that resolved to "no restriction at all" — an `'all'`
 * grant. The branch it appears in is dropped from the conditions rather than
 * interpolated, because the alternative (an `$in` over every id in existence)
 * cannot be written down. See {@link interpolateConditions}.
 */
const UNRESTRICTED = Symbol('authz.unrestricted');

/**
 * Paths under `scope.` that must resolve to an array. Returning `undefined`
 * for these would produce `{ $in: undefined }`, which matches unpredictably;
 * an empty array matches nothing, which is the safe reading of "you hold no
 * teams / no grants".
 */
function resolveScopePath(segments: string[], context: AbilityContext): unknown {
  const scope = context.scope;
  const [head, ...rest] = segments;

  if (head === 'teamIds') return scope?.teamIds ?? [];
  if (head === 'organizationId') return scope?.organizationId ?? null;
  if (head === 'grants') {
    // `${scope.grants.Project}` — a grant over one subject.
    const subjectName = rest[0];
    if (!subjectName) return [];
    const grant = scope?.grants?.[subjectName];
    if (grant === 'all') return UNRESTRICTED;
    return grant ?? [];
  }
  return undefined;
}

function resolvePath(path: string, context: AbilityContext): unknown {
  const segments = path.split('.');
  if (segments[0] === 'scope') return resolveScopePath(segments.slice(1), context);

  return segments.reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, context);
}

// CASL parameterizes conditions by the subject's field type. Because our
// subjects are free-form strings (not typed records), that collapses to
// `MongoQuery<never>`; conditions are validated at runtime instead.
type AbilityConditions = MongoQuery<never>;

/**
 * Deep-clone `conditions`, replacing any string value of the form `${path}`
 * with the corresponding value from the context. Non-placeholder values are
 * passed through untouched.
 */
function interpolateConditions(
  conditions: Record<string, unknown>,
  context: AbilityContext,
): AbilityConditions | undefined {
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const match = value.match(PLACEHOLDER);
      return match ? resolvePath(match[1], context) : value;
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      const source = value as Record<string, unknown>;
      const entries: [string, unknown][] = [];
      for (const [key, raw] of Object.entries(source)) {
        const walked = walk(raw);
        // An unrestricted branch removes the constraint it belonged to.
        if (walked === UNRESTRICTED) continue;
        entries.push([key, walked]);
      }
      // Every branch dropped ⇒ this object no longer restricts anything.
      if (Object.keys(source).length > 0 && entries.length === 0) {
        return UNRESTRICTED;
      }
      return Object.fromEntries(entries);
    }
    return value;
  };

  const result = walk(conditions);
  if (result === UNRESTRICTED) return undefined;
  return result as AbilityConditions;
}

/**
 * Interpolate a stored rule's `${...}` placeholders exactly the way
 * {@link defineAbilitiesFromPermissions} does when it builds an ability.
 *
 * Returns `undefined` when the conditions collapse to "no restriction" (every
 * branch resolved to an `'all'` scope grant). A placeholder the context cannot
 * resolve becomes `undefined` in place, as it does in the ability. Role-grant
 * containment uses this to compare a requested rule with the author's rules in
 * the same context.
 */
export function interpolatePermissionConditions(
  conditions: Record<string, unknown>,
  context: AbilityContext = {},
): Record<string, unknown> | undefined {
  return interpolateConditions(conditions, context) as Record<string, unknown> | undefined;
}

/**
 * Order rules so every `cannot` is applied after every `can`.
 *
 * CASL is last-rule-wins. A user holding several roles has their permissions
 * unioned in whatever order the database returned the roles, so without this a
 * deny in one role is silently overridden by a grant in another and the
 * effective ability depends on row order. Denies last makes "deny wins" a
 * property of the system rather than an accident. The split is stable, so
 * relative order within each group is preserved.
 */
function denyLast(permissions: readonly PermissionDefinition[]): PermissionDefinition[] {
  const allows: PermissionDefinition[] = [];
  const denies: PermissionDefinition[] = [];
  for (const permission of permissions) {
    (permission.inverted ? denies : allows).push(permission);
  }
  return [...allows, ...denies];
}

/**
 * Build a CASL ability from a flat list of permission definitions — typically
 * the union of every role assigned to a user.
 */
export function defineAbilitiesFromPermissions(
  permissions: PermissionDefinition[],
  context: AbilityContext = {},
): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  for (const permission of denyLast(permissions)) {
    const apply = permission.inverted ? cannot : can;
    const conditions = permission.conditions
      ? interpolateConditions(permission.conditions, context)
      : undefined;

    // Call the correct CASL overload: `(action, subject, fields, conditions)`
    // when fields are present, otherwise `(action, subject, conditions)` — so a
    // bare `conditions` is never mistaken for `fields`.
    if (permission.fields && permission.fields.length > 0) {
      apply(permission.action, permission.subject, permission.fields, conditions);
    } else {
      apply(permission.action, permission.subject, conditions);
    }
  }

  return build();
}

/**
 * Placeholder interpolated against the authenticated principal when the ability
 * is built (see {@link AbilityContext}) — it scopes a rule to the caller's own
 * resources.
 */
// biome-ignore lint/suspicious/noTemplateCurlyInString: this is a condition placeholder, not a template literal
const OWN_USER_ID = '${user.id}';

/** Placeholder for the caller's active organization (see {@link AbilityContext}). */
// biome-ignore lint/suspicious/noTemplateCurlyInString: this is a condition placeholder, not a template literal
const ACTIVE_ORGANIZATION_ID = '${activeOrganizationId}';

/**
 * Permissions granted to the seeded **system roles**. The seed installs them,
 * and the API's ability factory falls back to them for a `user.role` name that
 * has no role row.
 */
export const SYSTEM_ROLE_PERMISSIONS: Record<string, PermissionDefinition[]> = {
  superadmin: [{ action: 'manage', subject: 'all' }],
  admin: [{ action: 'manage', subject: 'all' }],
  /**
   * The tenant administrator, granted org-scoped to whoever creates an
   * organization or is invited into one as owner/admin.
   *
   * Everything here is an organization resource, narrowed to the active
   * organization by the `${activeOrganizationId}` placeholder. Nothing here
   * may touch `User`, `all` or another tenant: non-tenant routes such as
   * `DELETE /users/:id` check only action + subject, so a broader rule would
   * let anyone who creates a workspace delete arbitrary platform accounts.
   */
  owner: [
    { action: 'manage', subject: 'Organization', conditions: { id: ACTIVE_ORGANIZATION_ID } },
    { action: 'manage', subject: 'Member', conditions: { organizationId: ACTIVE_ORGANIZATION_ID } },
    {
      action: 'manage',
      subject: 'Invitation',
      conditions: { organizationId: ACTIVE_ORGANIZATION_ID },
    },
    {
      action: 'manage',
      subject: 'Workspace',
      conditions: { organizationId: ACTIVE_ORGANIZATION_ID },
    },
    // Roles the organization owns. A global role (`organizationId: null`)
    // does not match, which is what `RoleGrantPolicy.assertCanModify` relies
    // on to keep the platform's own roles out of a tenant admin's reach.
    { action: 'manage', subject: 'Role', conditions: { organizationId: ACTIVE_ORGANIZATION_ID } },
    // The control plane's workspace-owned resources. `Host` is deliberately
    // absent: it is person-owned and sits on the `user` role below. The tenant
    // boundary for what runs on a host is `work_session.organizationId`, not
    // the host row.
    //
    // A workspace **member** is granted none of these: there is no `member`
    // entry in this constant, and adding one is its own change with its own
    // migration.
    {
      action: 'manage',
      subject: 'Project',
      conditions: { organizationId: ACTIVE_ORGANIZATION_ID },
    },
    {
      action: 'manage',
      subject: 'Session',
      conditions: { organizationId: ACTIVE_ORGANIZATION_ID },
    },
    {
      action: 'manage',
      subject: 'Installation',
      conditions: { organizationId: ACTIVE_ORGANIZATION_ID },
    },
    {
      action: 'manage',
      subject: 'Automation',
      conditions: { organizationId: ACTIVE_ORGANIZATION_ID },
    },
    {
      action: 'manage',
      subject: 'Task',
      conditions: { organizationId: ACTIVE_ORGANIZATION_ID },
    },
    {
      action: 'manage',
      subject: 'Calendar',
      conditions: { organizationId: ACTIVE_ORGANIZATION_ID },
    },
    {
      action: 'manage',
      subject: 'PullRequest',
      conditions: { organizationId: ACTIVE_ORGANIZATION_ID },
    },
  ],
  /**
   * Deliberately small: what an account may do in a workspace comes from the
   * org-scoped role it holds there — granted with the personal workspace at
   * sign-up, on creating one, or by an invitation. No rule on
   * `User`: an unconditional one lets every account list and edit every other
   * across tenants. Profile editing goes through `/profile`; colleagues come
   * from the `Member` resource.
   */
  user: [
    // Which organizations this account belongs to, and nothing else about
    // them. Better Auth answers the read from the caller's own memberships, so
    // it discloses no organization they are not in — it is what lets the app
    // tell "you are in a workspace" from "you are waiting for an invitation".
    { action: 'read', subject: 'Organization' },
    // The recovery path: an account the sign-up hook left with no workspace
    // creates its own on `/onboarding`. `CreateOrganizationCommandHandler`
    // grants the creator the org-scoped `owner` role in the same act.
    { action: 'create', subject: 'Organization' },
    // Every user manages their own API tokens; the condition keeps them off
    // everyone else's.
    {
      action: 'read',
      subject: 'ApiToken',
      conditions: { userId: OWN_USER_ID },
    },
    {
      action: 'create',
      subject: 'ApiToken',
      conditions: { userId: OWN_USER_ID },
    },
    {
      action: 'delete',
      subject: 'ApiToken',
      conditions: { userId: OWN_USER_ID },
    },
    // A host is the person's machine, not a workspace's: one laptop is paired
    // once and every workspace its owner is in borrows it, and the login in
    // `~/.claude` on it is theirs. So it belongs on the person's role, exactly
    // as `ApiToken` does, and the condition keeps them off everyone else's.
    // Sharing a host with a teammate is an `access_grant` over `Host`.
    {
      action: 'manage',
      subject: 'Host',
      conditions: { ownerUserId: OWN_USER_ID },
    },
  ],
};

/**
 * Legacy: an ability from a single role name, using the seeded system-role
 * permissions. Prefer {@link defineAbilitiesFromPermissions} with the user's
 * DB-backed permissions.
 */
export function defineAbilitiesFor(role: Role, context: AbilityContext = {}): AppAbility {
  return defineAbilitiesFromPermissions(SYSTEM_ROLE_PERMISSIONS[role] ?? [], context);
}
