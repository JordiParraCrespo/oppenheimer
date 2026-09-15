import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * Asks which permissions a given principal may put on a credential. The answer
 * depends on their live roles, so only the server can compute it — this is what
 * the token-creation screen and the CLI’s `--permissions` validation read.
 */
export class FindGrantablePermissionsQuery extends QueryBase {
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
