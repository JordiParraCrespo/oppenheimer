/**
 * The three counters a user's role-derived permissions are cached on, read in
 * one round trip. Each is an opaque token: compare for equality, never do
 * arithmetic (Postgres `bigint` arrives as a string).
 *
 * Every writer that changes effective permissions bumps the counter that
 * covers it inside its own transaction (`authz-version.repository.ts`), so a
 * reader after the commit always sees a new version.
 */
export interface AuthzVersions {
  /**
   * `organization."roleVersion"` of the organization the caller acts in: its
   * own roles and the assignments scoped to it. `null` when the request acts
   * in no organization, or the organization does not exist.
   */
  organization: string | null;
  /** `role_catalog_version`: the global role definitions. */
  catalog: string;
  /** `user_role_version` for the caller: their global assignments. `'0'` with no row. */
  user: string;
}

export interface AuthzVersionRepositoryPort {
  /** Three primary-key lookups in one query. */
  read(userId: string | null, organizationId: string | null): Promise<AuthzVersions>;
}
