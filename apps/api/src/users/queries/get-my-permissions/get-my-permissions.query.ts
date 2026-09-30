import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * The answer depends on the caller's live roles and active organization, so
 * only the server can compute it.
 */
export class GetMyPermissionsQuery extends QueryBase {
  readonly userId: string;
  readonly role?: string;
  readonly organizationId?: string | null;

  constructor(props: {
    userId: string;
    role?: string;
    organizationId?: string | null;
  }) {
    super();
    this.userId = props.userId;
    this.role = props.role;
    this.organizationId = props.organizationId;
  }
}
