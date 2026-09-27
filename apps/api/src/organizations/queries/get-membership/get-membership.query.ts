import { QueryBase } from '@oppenheimer/backend-ddd';

/** The caller's own membership in the organization a route names. */
export class GetMembershipQuery extends QueryBase {
  readonly organizationId: string;
  readonly userId: string;

  constructor(props: { organizationId: string; userId: string }) {
    super();
    this.organizationId = props.organizationId;
    this.userId = props.userId;
  }
}
