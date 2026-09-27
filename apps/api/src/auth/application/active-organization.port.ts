/** Header a client uses to act in an organization other than the session's. */
export const ACTIVE_ORGANIZATION_HEADER = 'x-active-organization';

/**
 * Which organization a request that names none in its path acts in: the
 * session's active organization, or the `X-Active-Organization` override once
 * it is checked against the caller's memberships.
 *
 * A port because the check reads membership rows, and the kernel owns no
 * feature's tables: `authz` binds its `ActiveOrganizationResolver` to
 * {@link ACTIVE_ORGANIZATION}. Only `RequestTenantResolver` asks it — the
 * answer becomes the request's tenant and nothing reads the header again.
 */
export interface ActiveOrganizationPort {
  /**
   * The organization to act in. Throws when the header names an organization
   * the caller does not belong to.
   */
  resolve(input: {
    userId: string | undefined;
    sessionOrganizationId: string | null | undefined;
    header: string | undefined;
  }): Promise<string | null>;
}
