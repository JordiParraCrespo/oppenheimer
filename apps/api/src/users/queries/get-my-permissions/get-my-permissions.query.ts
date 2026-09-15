import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * Asks for the caller's own effective permissions. The answer depends on their
 * live roles and active organization, so only the server can compute it — the
 * web app reads it to decide which sidebar routes to show.
 */
export class GetMyPermissionsQuery extends QueryBase {
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
