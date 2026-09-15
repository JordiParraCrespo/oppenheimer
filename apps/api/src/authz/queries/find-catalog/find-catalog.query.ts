import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * Asks for the permission catalog and the subset of it the caller may grant.
 *
 * The grantable half depends on the caller's live roles, so only the server can
 * compute it — the role builder disables what it gets back rather than letting
 * an admin compose a role the API will reject.
 */
export class FindAuthzCatalogQuery extends QueryBase {
  readonly userId: string;
  readonly role?: string;
  readonly activeOrganizationId?: string | null;

  constructor(props: {
    userId: string;
    role?: string;
    activeOrganizationId?: string | null;
  }) {
    super();
    this.userId = props.userId;
    this.role = props.role;
    this.activeOrganizationId = props.activeOrganizationId;
  }
}
