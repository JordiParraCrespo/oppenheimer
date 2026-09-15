/**
 * Scope dimensions a resource can be narrowed by.
 *
 * - `organization` — tenant isolation. Almost always present.
 * - `team`         — the row belongs to a team (workspace) the caller may be in.
 * - `own`          — the row belongs to the caller personally.
 * - `grant`        — the row was granted explicitly (see the `access_grant` table).
 *
 * Within a resource these are **alternatives**, not requirements: satisfying
 * any one of `team` / `own` / `grant` makes a row visible. `organization` is
 * the exception and is always conjunctive — a tenant boundary is never
 * something another dimension can override.
 */
export type ScopeDimension = 'organization' | 'team' | 'own' | 'grant';

export interface ResourceActionDefinition {
  /** The CASL action string, e.g. `read`, `export`. */
  name: string;
  /** Shown in the role builder. Falls back to the name. */
  label?: string;
  /**
   * Surfaced with a warning in the role builder. Nothing in the enforcement
   * path treats a sensitive action differently — it is a UI affordance.
   */
  sensitive?: boolean;
}

/**
 * Which columns carry this resource's scope keys.
 *
 * This is the load-bearing part of a declaration: it is what lets the kernel
 * derive both the CASL condition and the SQL predicate from one place, so the
 * two can never disagree about what a scope means.
 */
export interface ResourceKeys {
  /** Column holding the tenant id. Required for the `organization` dimension. */
  organization?: string;
  /** Column holding the owning team id. Required for the `team` dimension. */
  team?: string;
  /** Column holding the owning user id. Required for the `own` dimension. */
  owner?: string;
  /** Primary key column. Used by the `grant` dimension. Defaults to `id`. */
  id?: string;
}

export interface ResourceDefinition {
  /** CASL subject string. Unique across the application. */
  subject: string;
  label: string;
  /** Groups resources in the role builder, e.g. `crm`, `platform`. */
  group: string;
  actions: readonly ResourceActionDefinition[];
  /** Fields the role builder may offer for field-level grants (CASL `fields`). */
  fields?: readonly string[];
  keys: ResourceKeys;
  scopes: readonly ScopeDimension[];
  /**
   * The credential-scope group this resource belongs to, so API tokens and MCP
   * clients can reach it. Resources without one are unreachable by scoped
   * credentials — which is the correct default for internal subjects.
   */
  credentialScope?: string;
}

/** The key each scope dimension requires to be present in `keys`. */
const REQUIRED_KEY: Record<ScopeDimension, keyof ResourceKeys> = {
  organization: 'organization',
  team: 'team',
  own: 'owner',
  grant: 'id',
};

/**
 * Validate a resource declaration and freeze it.
 *
 * Declarations are module-level constants, so throwing here fails the process
 * at boot. That is deliberate: a resource that declares `team` scoping without
 * a team column would otherwise produce a silently unfiltered query at the
 * first request that happened to exercise it.
 */
export function defineResource(definition: ResourceDefinition): ResourceDefinition {
  const keys: ResourceKeys = { id: 'id', ...definition.keys };

  if (!definition.subject.trim()) {
    throw new Error('A resource definition needs a non-empty subject');
  }
  if (definition.actions.length === 0) {
    throw new Error(`Resource "${definition.subject}" declares no actions`);
  }

  for (const dimension of definition.scopes) {
    const required = REQUIRED_KEY[dimension];
    if (!keys[required]) {
      throw new Error(
        `Resource "${definition.subject}" declares the "${dimension}" scope but no keys.${required} column`,
      );
    }
  }

  const duplicate = definition.actions
    .map((action) => action.name)
    .find((name, index, all) => all.indexOf(name) !== index);
  if (duplicate) {
    throw new Error(`Resource "${definition.subject}" declares the action "${duplicate}" twice`);
  }

  return Object.freeze({ ...definition, keys: Object.freeze(keys) });
}
